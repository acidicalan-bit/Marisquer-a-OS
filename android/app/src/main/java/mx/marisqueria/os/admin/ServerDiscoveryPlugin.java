package mx.marisqueria.os.admin;

import android.content.Context;
import android.net.DhcpInfo;
import android.net.wifi.WifiManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.Inet4Address;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ServerDiscovery")
public class ServerDiscoveryPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void verifyServer(PluginCall call) {
        String rawUrl = call.getString("url");
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                URI uri = new URI(rawUrl == null ? "" : rawUrl);
                String host = uri.getHost();
                if (!"http".equals(uri.getScheme()) || host == null || uri.getPort() != 3210
                        || uri.getRawUserInfo() != null || uri.getRawQuery() != null
                        || uri.getRawFragment() != null || (uri.getRawPath() != null
                                && !uri.getRawPath().isEmpty() && !"/".equals(uri.getRawPath()))
                        || !isPrivateIpv4(host)) {
                    call.resolve(verificationResult(false));
                    return;
                }

                URL healthUrl = new URL("http", host, 3210, "/api/health");
                connection = (HttpURLConnection) healthUrl.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(2500);
                connection.setReadTimeout(2500);
                connection.setUseCaches(false);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "application/json");

                if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    call.resolve(verificationResult(false));
                    return;
                }
                StringBuilder body = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                        connection.getInputStream(), StandardCharsets.UTF_8))) {
                    char[] buffer = new char[512];
                    int count;
                    while ((count = reader.read(buffer)) != -1 && body.length() < 4096) {
                        body.append(buffer, 0, Math.min(count, 4096 - body.length()));
                    }
                }
                JSONObject health = new JSONObject(body.toString());
                call.resolve(verificationResult(health.optBoolean("ok", false)
                        && "marisqueria-os".equals(health.optString("service", ""))));
            } catch (Exception ignored) {
                call.resolve(verificationResult(false));
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }

    private static JSObject verificationResult(boolean ok) {
        JSObject result = new JSObject();
        result.put("ok", ok);
        return result;
    }

    private static boolean isPrivateIpv4(String host) {
        if (!host.matches("[0-9]{1,3}(\\.[0-9]{1,3}){3}")) return false;
        try {
            InetAddress address = InetAddress.getByName(host);
            if (!(address instanceof Inet4Address)) return false;
            byte[] bytes = address.getAddress();
            int first = bytes[0] & 0xff;
            int second = bytes[1] & 0xff;
            boolean privateAddress = first == 10
                    || (first == 172 && second >= 16 && second <= 31)
                    || (first == 192 && second == 168);
            return privateAddress && address.getHostAddress().equals(host);
        } catch (Exception ignored) {
            return false;
        }
    }

    @PluginMethod
    public void discover(PluginCall call) {
        executor.execute(() -> {
            JSArray servers = new JSArray();
            Set<String> seen = new LinkedHashSet<>();
            WifiManager.MulticastLock lock = null;
            try {
                WifiManager wifi = (WifiManager) getContext().getApplicationContext()
                        .getSystemService(Context.WIFI_SERVICE);
                if (wifi != null) {
                    lock = wifi.createMulticastLock("barlovento-server-discovery");
                    lock.setReferenceCounted(false);
                    lock.acquire();
                }

                byte[] request = "BARLOVENTO_DISCOVER_V1".getBytes(StandardCharsets.UTF_8);
                long deadline = System.currentTimeMillis() + 3500;
                try (DatagramSocket socket = new DatagramSocket()) {
                    socket.setBroadcast(true);
                    socket.setSoTimeout(350);
                    // Algunos routers/tablets bloquean el broadcast global. Enviar también al
                    // broadcast calculado de la subred Wi-Fi hace que la detección funcione sin
                    // pedir al mesero que escriba la IP de la PC.
                    List<InetAddress> targets = new ArrayList<>();
                    targets.add(InetAddress.getByName("255.255.255.255"));
                    if (wifi != null) {
                        DhcpInfo dhcp = wifi.getDhcpInfo();
                        if (dhcp != null && dhcp.ipAddress != 0 && dhcp.netmask != 0) {
                            int broadcast = dhcp.ipAddress | ~dhcp.netmask;
                            InetAddress subnetBroadcast = ipv4FromLittleEndianInt(broadcast);
                            if (!subnetBroadcast.getHostAddress().equals("255.255.255.255")) {
                                targets.add(subnetBroadcast);
                            }
                        }
                    }
                    for (InetAddress target : targets) {
                        DatagramPacket probe = new DatagramPacket(
                                request, request.length, target, 3211);
                        socket.send(probe);
                    }
                    while (System.currentTimeMillis() < deadline) {
                        byte[] buffer = new byte[512];
                        DatagramPacket reply = new DatagramPacket(buffer, buffer.length);
                        try {
                            socket.receive(reply);
                            String body = new String(reply.getData(), reply.getOffset(),
                                    reply.getLength(), StandardCharsets.UTF_8);
                            if (!body.contains("\"service\":\"barlovento-pos\"")
                                    || !body.contains("\"port\":3210")) continue;
                            String url = "http://" + reply.getAddress().getHostAddress() + ":3210";
                            if (seen.add(url)) servers.put(url);
                        } catch (java.net.SocketTimeoutException ignored) {
                            // Keep listening until the bounded discovery window closes.
                        }
                    }
                }
                JSObject result = new JSObject();
                result.put("servers", servers);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("No se pudo buscar la PC en esta red.", error);
            } finally {
                if (lock != null && lock.isHeld()) lock.release();
            }
        });
    }

    private static InetAddress ipv4FromLittleEndianInt(int value) throws Exception {
        byte[] bytes = new byte[] {
                (byte) (value & 0xff),
                (byte) ((value >>> 8) & 0xff),
                (byte) ((value >>> 16) & 0xff),
                (byte) ((value >>> 24) & 0xff)
        };
        return InetAddress.getByAddress(bytes);
    }
}

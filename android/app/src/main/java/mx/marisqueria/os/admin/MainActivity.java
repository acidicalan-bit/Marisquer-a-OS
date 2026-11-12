package mx.marisqueria.os.admin;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ServerDiscoveryPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

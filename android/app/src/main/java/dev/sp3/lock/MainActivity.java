package dev.sp3.lock;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenshotProtectPlugin.class);
        super.onCreate(savedInstanceState);
        // Screenshot protection on by default; JS may toggle it via the plugin.
        getWindow()
            .setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }
}

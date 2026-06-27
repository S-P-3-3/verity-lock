package dev.verity.lock;

import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Toggles FLAG_SECURE on the activity window. When enabled the app content is
 * excluded from screenshots and from the recent-apps preview (security).
 */
@CapacitorPlugin(name = "ScreenshotProtect")
public class ScreenshotProtectPlugin extends Plugin {

    @PluginMethod
    public void setEnabled(PluginCall call) {
        final boolean enabled = call.getBoolean("enabled", true);
        getActivity()
            .runOnUiThread(
                () -> {
                    if (enabled) {
                        getActivity()
                            .getWindow()
                            .setFlags(
                                WindowManager.LayoutParams.FLAG_SECURE,
                                WindowManager.LayoutParams.FLAG_SECURE
                            );
                    } else {
                        getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    }
                }
            );
        call.resolve();
    }
}

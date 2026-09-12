package com.bodhaai.app;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/** Loads the shared React frontend (frontend/dist) inside the Capacitor WebView. */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // Keep the WebView below the status bar — Android 15 otherwise starts at y=0.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    getWindow().setStatusBarColor(Color.parseColor("#F3EFE6"));
    getWindow().setNavigationBarColor(Color.parseColor("#F3EFE6"));
    WindowInsetsControllerCompat insets =
        new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
    insets.setAppearanceLightStatusBars(true);
    insets.setAppearanceLightNavigationBars(true);
  }
}

package it.scheda.palestra;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.lang.ref.WeakReference;

/**
 * App Android "Scheda": mostra la web app pubblicata su GitHub Pages (così gli aggiornamenti
 * arrivano da soli) e le dà accesso a timer nativo, file, stampa e schermo sempre acceso.
 */
public class MainActivity extends Activity {
    static final String APP_URL = "https://mattiacl.github.io/Tracker-Scheda/";
    private static final String APP_HOST = "mattiacl.github.io";
    private static final int REQ_FILE = 2;
    private static final int REQ_NOTIF = 3;

    private static volatile boolean visible = false;
    private static WeakReference<MainActivity> current = new WeakReference<>(null);

    private WebView web;
    private ValueCallback<Uri[]> fileCb;

    static boolean isVisible() { return visible; }

    /** Avvisa la pagina che il timer è cambiato (es. "+15 s" o "Salta" premuti nella notifica). */
    static void syncWeb() {
        MainActivity a = current.get();
        if (a == null) return;
        a.runOnUiThread(() -> {
            if (a.web != null) a.web.evaluateJavascript("window.nativeTimerSync && window.nativeTimerSync()", null);
        });
    }

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        current = new WeakReference<>(this);
        TimerCore.channels(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0B0C0F);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);

        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                String scheme = u.getScheme();
                if (("http".equals(scheme) || "https".equals(scheme)) && !APP_HOST.equals(u.getHost())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                    return true;
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (!req.isForMainFrame()) return;
                String html = "<html><body style='background:#0b0c0f;color:#e8e8ea;font-family:sans-serif;"
                        + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center;padding:24px'>"
                        + "<h2 style='font-weight:600'>Nessuna connessione</h2>"
                        + "<p style='color:#8a8d96'>La prima apertura serve internet. Dopo l'app funziona anche offline.</p>"
                        + "<button onclick=\"location.href='" + APP_URL + "'\" style='margin-top:16px;padding:12px 22px;border:0;"
                        + "border-radius:12px;background:#f28b8b;color:#2a0b0b;font-size:16px;font-weight:600'>Riprova</button>"
                        + "</body></html>";
                v.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Scegli il file di backup"), REQ_FILE);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(APP_URL);

        askNotificationsFirstTime();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onResume() {
        super.onResume();
        visible = true;
        current = new WeakReference<>(this);
        if (web != null) {
            web.onResume();
            web.evaluateJavascript("window.nativeTimerSync && window.nativeTimerSync();"
                    + "if (typeof view !== 'undefined' && view.name === 'settings' && typeof render === 'function') render();", null);
        }
    }

    @Override
    protected void onPause() {
        visible = false;
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (current.get() == this) current = new WeakReference<>(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // il tasto indietro di Android fa come la freccia in alto nell'app
        web.evaluateJavascript("(window.androidBack && window.androidBack()) ? 1 : 0", v -> {
            if (!"1".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCb != null) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null && data.getData() != null) r = new Uri[]{data.getData()};
            fileCb.onReceiveValue(r);
            fileCb = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        super.onRequestPermissionsResult(req, perms, results);
        if (req == REQ_NOTIF && web != null) {
            web.evaluateJavascript("if (typeof view !== 'undefined' && view.name === 'settings' && typeof render === 'function') render();", null);
        }
    }

    /* ---------- permesso notifiche (Android 13+) ---------- */
    private SharedPreferences appPrefs() { return getSharedPreferences("app", MODE_PRIVATE); }

    private void askNotificationsFirstTime() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        if (appPrefs().getBoolean("askedNotif", false)) return;
        appPrefs().edit().putBoolean("askedNotif", true).apply();
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
    }

    private void requestNotifications() {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && (!appPrefs().getBoolean("askedNotif", false) || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS))) {
            appPrefs().edit().putBoolean("askedNotif", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQ_NOTIF);
            return;
        }
        // già negate in modo definitivo: apro le impostazioni delle notifiche dell'app
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
        try { startActivity(i); } catch (Exception ignored) { }
    }

    /* ---------- salvataggio e condivisione file ---------- */
    private void saveFile(String b64, String name, String mime, boolean share) {
        try {
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            ContentResolver cr = getContentResolver();
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Scheda");
            cv.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new IllegalStateException("insert");
            try (OutputStream os = cr.openOutputStream(uri)) {
                if (os == null) throw new IllegalStateException("stream");
                os.write(bytes);
            }
            cv.clear();
            cv.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(uri, cv, null, null);

            runOnUiThread(() -> {
                if (share) {
                    Intent send = new Intent(Intent.ACTION_SEND);
                    send.setType(mime);
                    send.putExtra(Intent.EXTRA_STREAM, uri);
                    send.setClipData(ClipData.newRawUri(name, uri));
                    send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent ch = Intent.createChooser(send, "Invia resoconto");
                    ch.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    startActivity(ch);
                } else {
                    Toast.makeText(this, "Salvato in Download/Scheda", Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(this, "Salvataggio non riuscito", Toast.LENGTH_LONG).show());
        }
    }

    /* ---------- funzioni chiamabili dalla pagina (window.AndroidApp) ---------- */
    private class Bridge {
        @JavascriptInterface
        public void timerStart(double end, int total, String label, boolean sound, boolean vibrate) {
            TimerCore.start(MainActivity.this, (long) end, total, label, sound, vibrate);
        }

        @JavascriptInterface
        public void timerStop() { TimerCore.stop(MainActivity.this); }

        @JavascriptInterface
        public String timerState() { return TimerCore.stateJson(MainActivity.this); }

        @JavascriptInterface
        public String notifStatus() {
            if (getSystemService(NotificationManager.class).areNotificationsEnabled()) return "granted";
            return appPrefs().getBoolean("askedNotif", false) ? "denied" : "default";
        }

        @JavascriptInterface
        public void requestNotif() { runOnUiThread(MainActivity.this::requestNotifications); }

        @JavascriptInterface
        public void saveFile(String b64, String name, String mime, boolean share) {
            MainActivity.this.saveFile(b64, name, mime, share);
        }

        @JavascriptInterface
        public void print() {
            runOnUiThread(() -> {
                PrintManager pm = getSystemService(PrintManager.class);
                pm.print("Resoconto allenamento", web.createPrintDocumentAdapter("Resoconto allenamento"),
                        new PrintAttributes.Builder().build());
            });
        }

        @JavascriptInterface
        public void keepScreenOn(boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public String version() { return "1.0"; }
    }
}

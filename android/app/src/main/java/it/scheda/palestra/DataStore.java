package it.scheda.palestra;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Copie di sicurezza dei dati, fuori dalla memoria del WebView:
 *  1. file interno dell'app (dati.json): se il WebView perde i dati, l'app li recupera da qui all'avvio;
 *  2. backup automatico in Download/Scheda/backup-automatico.json, sovrascritto a ogni salvataggio:
 *     resta anche se disinstalli l'app. Dopo una reinstallazione Android non lo fa più modificare
 *     all'app, quindi ne crea uno nuovo accanto ("backup-automatico (1).json") e quello vecchio non si tocca.
 */
final class DataStore {
    private static final String FILE = "dati.json";
    private static final String BACKUP_NAME = "backup-automatico.json";

    private DataStore() { }

    static synchronized void save(Context c, String json, boolean backup) {
        if (json == null || json.length() < 20) return;
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        try {
            File dir = c.getFilesDir();
            File tmp = new File(dir, FILE + ".tmp");
            File f = new File(dir, FILE);
            try (FileOutputStream os = new FileOutputStream(tmp)) {
                os.write(bytes);
                os.getFD().sync();
            }
            if (!tmp.renameTo(f)) {
                f.delete();
                tmp.renameTo(f);
            }
        } catch (Exception ignored) { }
        if (backup) {
            try { writeDownload(c, bytes); } catch (Exception ignored) { }
        }
    }

    static synchronized String load(Context c) {
        File f = new File(c.getFilesDir(), FILE);
        if (!f.exists()) return "";
        try (InputStream in = new FileInputStream(f)) {
            return readAll(in);
        } catch (Exception e) {
            return "";
        }
    }

    private static void writeDownload(Context c, byte[] bytes) throws Exception {
        SharedPreferences p = c.getSharedPreferences("backup_auto", Context.MODE_PRIVATE);
        ContentResolver cr = c.getContentResolver();

        String saved = p.getString("uri", null);
        if (saved != null) {
            try (OutputStream os = cr.openOutputStream(Uri.parse(saved), "wt")) {
                if (os != null) {
                    os.write(bytes);
                    return;
                }
            } catch (Exception e) {
                // file cancellato o non più accessibile: lo ricreo qui sotto
            }
        }

        ContentValues cv = new ContentValues();
        cv.put(MediaStore.MediaColumns.DISPLAY_NAME, BACKUP_NAME);
        cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
        cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Scheda");
        Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
        if (uri == null) return;
        try (OutputStream os = cr.openOutputStream(uri, "wt")) {
            if (os != null) os.write(bytes);
        }
        p.edit().putString("uri", uri.toString()).apply();
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        return new String(bos.toByteArray(), StandardCharsets.UTF_8);
    }
}

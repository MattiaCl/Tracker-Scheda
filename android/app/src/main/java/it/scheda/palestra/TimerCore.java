package it.scheda.palestra;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.SystemClock;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;

/**
 * Timer di recupero gestito da Android: notifica con conto alla rovescia che scorre da solo
 * e sveglia esatta a fine recupero (funziona anche a schermo spento o con l'app chiusa).
 */
final class TimerCore {
    static final String ACT_END = "it.scheda.palestra.TIMER_END";
    static final String ACT_ADD = "it.scheda.palestra.TIMER_ADD15";
    static final String ACT_SKIP = "it.scheda.palestra.TIMER_SKIP";

    private static final String CH_RUN = "recupero_in_corso";
    private static final int ID_RUN = 1;
    private static final int ID_END = 2;
    private static final String PREF = "timer";

    private TimerCore() { }

    /* ---------- canali di notifica ---------- */
    static void channels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);

        NotificationChannel run = new NotificationChannel(CH_RUN, "Recupero in corso", NotificationManager.IMPORTANCE_LOW);
        run.setDescription("Conto alla rovescia del recupero");
        run.setSound(null, null);
        run.enableVibration(false);
        run.setShowBadge(false);

        AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        long[] pattern = {0, 400, 150, 400, 150, 700};

        NotificationChannel sv = new NotificationChannel(endChannel(true, true), "Fine recupero", NotificationManager.IMPORTANCE_HIGH);
        sv.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), aa);
        sv.enableVibration(true);
        sv.setVibrationPattern(pattern);

        NotificationChannel s = new NotificationChannel(endChannel(true, false), "Fine recupero (solo suono)", NotificationManager.IMPORTANCE_HIGH);
        s.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), aa);
        s.enableVibration(false);

        NotificationChannel v = new NotificationChannel(endChannel(false, true), "Fine recupero (solo vibrazione)", NotificationManager.IMPORTANCE_HIGH);
        v.setSound(null, null);
        v.enableVibration(true);
        v.setVibrationPattern(pattern);

        NotificationChannel m = new NotificationChannel(endChannel(false, false), "Fine recupero (silenziosa)", NotificationManager.IMPORTANCE_HIGH);
        m.setSound(null, null);
        m.enableVibration(false);

        nm.createNotificationChannels(Arrays.asList(run, sv, s, v, m));
    }

    private static String endChannel(boolean sound, boolean vibrate) {
        return "fine_recupero_" + (sound ? "s" : "") + (vibrate ? "v" : "") + "_";
    }

    /* ---------- stato salvato ---------- */
    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    static String stateJson(Context c) {
        SharedPreferences p = prefs(c);
        long end = p.getLong("end", 0);
        if (end <= 0) return "";
        try {
            JSONObject o = new JSONObject();
            o.put("end", end);
            o.put("total", p.getInt("total", 0));
            o.put("label", p.getString("label", ""));
            return o.toString();
        } catch (Exception e) {
            return "";
        }
    }

    /* ---------- comandi ---------- */
    static void start(Context c, long end, int total, String label, boolean sound, boolean vibrate) {
        prefs(c).edit()
                .putLong("end", end)
                .putInt("total", total)
                .putString("label", label == null ? "" : label)
                .putBoolean("sound", sound)
                .putBoolean("vibrate", vibrate)
                .apply();
        c.getSystemService(NotificationManager.class).cancel(ID_END);
        showRunning(c);
        scheduleAlarm(c, end);
    }

    static void addSeconds(Context c, int sec) {
        SharedPreferences p = prefs(c);
        long end = p.getLong("end", 0);
        if (end <= 0) return;
        end = Math.max(System.currentTimeMillis() + 1000, end + sec * 1000L);
        int total = Math.max(1, p.getInt("total", 0) + sec);
        p.edit().putLong("end", end).putInt("total", total).apply();
        showRunning(c);
        scheduleAlarm(c, end);
    }

    static void stop(Context c) {
        prefs(c).edit().remove("end").apply();
        c.getSystemService(AlarmManager.class).cancel(pending(c, ACT_END, 10));
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.cancel(ID_RUN);
        nm.cancel(ID_END);
    }

    /** Chiamato dalla sveglia a fine recupero. */
    static void finished(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getLong("end", 0) <= 0) return;
        String label = p.getString("label", "");
        boolean sound = p.getBoolean("sound", true);
        boolean vibrate = p.getBoolean("vibrate", true);
        p.edit().remove("end").apply();

        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.cancel(ID_RUN);
        // se l'app è aperta davanti, suono e vibrazione li fa già lei
        if (MainActivity.isVisible()) return;

        Notification n = new Notification.Builder(c, endChannel(sound, vibrate))
                .setSmallIcon(R.drawable.ic_stat_timer)
                .setColor(0xFFEF5350)
                .setContentTitle("Recupero finito 💪")
                .setContentText((label.isEmpty() ? "" : label + " · ") + "tocca per tornare all'allenamento")
                .setCategory(Notification.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(openApp(c))
                .build();
        nm.notify(ID_END, n);
    }

    /* ---------- notifica con il conto alla rovescia ---------- */
    private static void showRunning(Context c) {
        SharedPreferences p = prefs(c);
        long end = p.getLong("end", 0);
        if (end <= 0) return;
        String label = p.getString("label", "");
        long left = Math.max(0, end - System.currentTimeMillis());
        String at = new SimpleDateFormat("HH:mm:ss", Locale.ITALY).format(new Date(end));

        RemoteViews rv = new RemoteViews(c.getPackageName(), R.layout.notif_timer);
        rv.setChronometer(R.id.chrono, SystemClock.elapsedRealtime() + left, null, true);
        rv.setChronometerCountDown(R.id.chrono, true);
        rv.setTextViewText(R.id.label, label.isEmpty() ? "Recupero" : label);
        rv.setTextViewText(R.id.sub, "Finisce alle " + at);

        Notification n = new Notification.Builder(c, CH_RUN)
                .setSmallIcon(R.drawable.ic_stat_timer)
                .setColor(0xFFEF5350)
                .setContentTitle("Recupero · " + label)
                .setStyle(new Notification.DecoratedCustomViewStyle())
                .setCustomContentView(rv)
                .setCustomBigContentView(rv)
                .setShowWhen(false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(Notification.CATEGORY_STOPWATCH)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setTimeoutAfter(left + 5000)
                .setContentIntent(openApp(c))
                .addAction(new Notification.Action.Builder((Icon) null, "+15 s", pending(c, ACT_ADD, 11)).build())
                .addAction(new Notification.Action.Builder((Icon) null, "Salta", pending(c, ACT_SKIP, 12)).build())
                .build();
        c.getSystemService(NotificationManager.class).notify(ID_RUN, n);
    }

    private static void scheduleAlarm(Context c, long end) {
        AlarmManager am = c.getSystemService(AlarmManager.class);
        PendingIntent pi = pending(c, ACT_END, 10);
        am.cancel(pi);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, pi);
    }

    private static PendingIntent pending(Context c, String action, int code) {
        Intent i = new Intent(c, TimerReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, 20, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}

package it.scheda.palestra;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Riceve la sveglia di fine recupero e i pulsanti "+15 s" / "Salta" della notifica. */
public class TimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String a = intent.getAction();
        if (TimerCore.ACT_END.equals(a)) TimerCore.finished(c);
        else if (TimerCore.ACT_ADD.equals(a)) TimerCore.addSeconds(c, 15);
        else if (TimerCore.ACT_SKIP.equals(a)) TimerCore.stop(c);
        MainActivity.syncWeb();
    }
}

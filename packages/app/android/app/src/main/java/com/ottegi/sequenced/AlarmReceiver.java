package com.ottegi.sequenced;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** Fired by AlarmManager.setAlarmClock at the scheduled time; hands off to the foreground service that actually rings. */
public class AlarmReceiver extends BroadcastReceiver {

    public static final String EXTRA_ALARM_ID = "alarmId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";

    @Override
    public void onReceive(Context context, Intent intent) {
        Intent serviceIntent = new Intent(context, AlarmForegroundService.class);
        serviceIntent.putExtra(EXTRA_ALARM_ID, intent.getStringExtra(EXTRA_ALARM_ID));
        serviceIntent.putExtra(EXTRA_TITLE, intent.getStringExtra(EXTRA_TITLE));
        serviceIntent.putExtra(EXTRA_BODY, intent.getStringExtra(EXTRA_BODY));
        ContextCompat.startForegroundService(context, serviceIntent);
    }
}

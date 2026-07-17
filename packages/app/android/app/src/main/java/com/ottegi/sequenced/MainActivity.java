package com.ottegi.sequenced;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {

    public static final String ACTION_ALARM_COMPLETE = "com.ottegi.sequenced.ALARM_COMPLETE";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CalendarPlugin.class);
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);
        handleAlarmIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAlarmIntent(intent);
    }

    private void handleAlarmIntent(Intent intent) {
        if (intent == null || !ACTION_ALARM_COMPLETE.equals(intent.getAction())) return;

        String alarmId = intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        if (alarmId == null || alarmId.isEmpty()) return;

        PluginHandle handle = getBridge().getPlugin("AlarmNative");
        if (handle != null && handle.getInstance() instanceof AlarmPlugin) {
            ((AlarmPlugin) handle.getInstance()).notifyAlarmFired(alarmId);
        }
    }
}

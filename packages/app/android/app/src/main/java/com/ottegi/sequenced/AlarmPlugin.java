package com.ottegi.sequenced;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Bridges the JS-facing "AlarmNative" plugin (packages/app/src/plugins/alarm.ts) to
 * Android's alarm-clock architecture: AlarmManager.setAlarmClock (exact, Doze-proof,
 * shows the OS alarm-clock status icon) -> AlarmReceiver -> AlarmForegroundService
 * (loops the ring sound on STREAM_ALARM) -> a full-screen-intent notification that
 * launches AlarmRingActivity over the lock screen with Dismiss/Snooze/Mark Complete.
 */
@CapacitorPlugin(name = "AlarmNative")
public class AlarmPlugin extends Plugin {

    static AlarmPlugin instance;

    @Override
    protected void handleOnStart() {
        instance = this;
    }

    @PluginMethod
    public void schedule(PluginCall call) {
        JSObject alarm = call.getObject("alarm");
        if (alarm == null) {
            call.reject("alarm is required.");
            return;
        }

        String id = alarm.getString("id");
        String fireAtStr = alarm.getString("fireAt");
        String title = alarm.getString("title", "TidalTask");
        String body = alarm.getString("body", "");

        if (id == null || id.isEmpty() || fireAtStr == null || fireAtStr.isEmpty()) {
            call.reject("alarm.id and alarm.fireAt are required.");
            return;
        }

        long fireAtMillis = parseIsoInstant(fireAtStr);
        if (fireAtMillis < 0) {
            call.reject("alarm.fireAt must be an ISO-8601 datetime.");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            call.reject("AlarmManager unavailable.");
            return;
        }

        int requestCode = id.hashCode();

        Intent ringIntent = new Intent(context, AlarmReceiver.class);
        ringIntent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, id);
        ringIntent.putExtra(AlarmReceiver.EXTRA_TITLE, title);
        ringIntent.putExtra(AlarmReceiver.EXTRA_BODY, body);

        PendingIntent operation = PendingIntent.getBroadcast(
            context, requestCode, ringIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Tapping the OS alarm-clock status icon opens the app (same as tapping a
        // notification) rather than a dedicated "show alarms" screen.
        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent showOperation = PendingIntent.getActivity(
            context, requestCode, showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        AlarmManager.AlarmClockInfo info = new AlarmManager.AlarmClockInfo(fireAtMillis, showOperation);
        alarmManager.setAlarmClock(info, operation);

        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id is required.");
            return;
        }

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent ringIntent = new Intent(context, AlarmReceiver.class);
        PendingIntent operation = PendingIntent.getBroadcast(
            context, id.hashCode(), ringIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (alarmManager != null) alarmManager.cancel(operation);
        operation.cancel();

        context.stopService(new Intent(context, AlarmForegroundService.class));
        call.resolve();
    }

    @PluginMethod
    public void stopRinging(PluginCall call) {
        Context context = getContext();
        context.stopService(new Intent(context, AlarmForegroundService.class));
        call.resolve();
    }

    /** Called from MainActivity when the user taps "Mark Complete" on AlarmRingActivity. */
    void notifyAlarmFired(String alarmId) {
        JSObject data = new JSObject();
        data.put("id", alarmId);
        notifyListeners("alarmFired", data);
    }

    private long parseIsoInstant(String value) {
        try {
            SimpleDateFormat withMillis = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            withMillis.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date parsed = withMillis.parse(value);
            return parsed != null ? parsed.getTime() : -1;
        } catch (ParseException e) {
            try {
                SimpleDateFormat noMillis = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
                noMillis.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date parsed = noMillis.parse(value);
                return parsed != null ? parsed.getTime() : -1;
            } catch (ParseException e2) {
                return -1;
            }
        }
    }
}

package com.ottegi.sequenced;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service that rings continuously (STREAM_ALARM, bypasses silent/DND like a
 * real alarm clock) until AlarmPlugin.stopRinging is called (Dismiss/Snooze/Mark Complete)
 * or the user dismisses it from AlarmRingActivity. Also posts a full-screen-intent
 * notification so the ringing UI shows even over the lock screen.
 */
public class AlarmForegroundService extends Service {

    private static final String CHANNEL_ID = "tidaltask-alarms";
    private static final int NOTIFICATION_ID = 91100;

    private Ringtone ringtone;
    private Vibrator vibrator;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String alarmId = intent != null ? intent.getStringExtra(AlarmReceiver.EXTRA_ALARM_ID) : null;
        String title = intent != null ? intent.getStringExtra(AlarmReceiver.EXTRA_TITLE) : "TidalTask";
        String body = intent != null ? intent.getStringExtra(AlarmReceiver.EXTRA_BODY) : "";

        createChannelIfNeeded();
        startForeground(NOTIFICATION_ID, buildNotification(alarmId, title, body));
        startRinging();

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopRinging();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void startRinging() {
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        ringtone = RingtoneManager.getRingtone(this, RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM));
        if (ringtone != null) {
            ringtone.setAudioAttributes(attributes);
            ringtone.setLooping(true);
            ringtone.play();
        }

        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            long[] pattern = {0, 800, 800};
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
    }

    private void stopRinging() {
        if (ringtone != null && ringtone.isPlaying()) ringtone.stop();
        if (vibrator != null) vibrator.cancel();
        stopForeground(true);
        stopSelf();
    }

    private void createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Ringing task and group alarms.");
        channel.setSound(null, null); // the foreground service plays the ring sound itself
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String alarmId, String title, String body) {
        Intent ringActivityIntent = new Intent(this, AlarmRingActivity.class);
        ringActivityIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        ringActivityIntent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        ringActivityIntent.putExtra(AlarmReceiver.EXTRA_TITLE, title);
        ringActivityIntent.putExtra(AlarmReceiver.EXTRA_BODY, body);

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this, alarmId != null ? alarmId.hashCode() : 0, ringActivityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(title != null && !title.isEmpty() ? title : "TidalTask Alarm")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .build();
    }
}

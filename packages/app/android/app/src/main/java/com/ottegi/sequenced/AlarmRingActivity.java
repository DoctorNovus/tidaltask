package com.ottegi.sequenced;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Minimal native ringing screen shown full-screen over the lock screen (Android has no
 * Dynamic Island equivalent, so this is the whole native experience). Built
 * programmatically rather than from an XML layout to keep this self-contained.
 *
 * Dismiss/Snooze act immediately and natively, independent of the JS layer/app process.
 * "Mark Complete" needs task/group data to render a real checklist, so it hands off to
 * the Capacitor app (AlarmRingingOverlay), stopping the native ringing once it does.
 */
public class AlarmRingActivity extends Activity {

    private static final int[] SNOOZE_MINUTES = {5, 10, 15, 20, 25, 30};

    private String alarmId;
    private String title;
    private String body;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        showOverLockScreen();

        alarmId = getIntent().getStringExtra(AlarmReceiver.EXTRA_ALARM_ID);
        title = getIntent().getStringExtra(AlarmReceiver.EXTRA_TITLE);
        body = getIntent().getStringExtra(AlarmReceiver.EXTRA_BODY);

        setContentView(buildLayout());
    }

    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) keyguardManager.requestDismissKeyguard(this, null);
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
    }

    private View buildLayout() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setBackgroundColor(Color.parseColor("#121720"));
        int pad = dp(24);
        root.setPadding(pad, dp(64), pad, dp(32));

        TextView titleView = new TextView(this);
        titleView.setText(title != null && !title.isEmpty() ? title : "TidalTask Alarm");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(26);
        titleView.setTypeface(null, Typeface.BOLD);
        titleView.setGravity(Gravity.CENTER);
        root.addView(titleView);

        if (body != null && !body.isEmpty()) {
            TextView bodyView = new TextView(this);
            bodyView.setText(body);
            bodyView.setTextColor(Color.parseColor("#A0AEC0"));
            bodyView.setTextSize(16);
            bodyView.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            );
            bodyParams.topMargin = dp(12);
            root.addView(bodyView, bodyParams);
        }

        Button completeButton = new Button(this);
        completeButton.setText("Mark Complete");
        completeButton.setOnClickListener(v -> markComplete());
        LinearLayout.LayoutParams completeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        completeParams.topMargin = dp(48);
        root.addView(completeButton, completeParams);

        TextView snoozeLabel = new TextView(this);
        snoozeLabel.setText("Snooze");
        snoozeLabel.setTextColor(Color.parseColor("#A0AEC0"));
        snoozeLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams snoozeLabelParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        snoozeLabelParams.topMargin = dp(24);
        root.addView(snoozeLabel, snoozeLabelParams);

        LinearLayout snoozeRow = new LinearLayout(this);
        snoozeRow.setOrientation(LinearLayout.HORIZONTAL);
        snoozeRow.setGravity(Gravity.CENTER);
        for (int minutes : SNOOZE_MINUTES) {
            Button snoozeButton = new Button(this);
            snoozeButton.setText(minutes + "m");
            snoozeButton.setOnClickListener(v -> snooze(minutes));
            snoozeRow.addView(snoozeButton);
        }
        LinearLayout.LayoutParams snoozeRowParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        snoozeRowParams.topMargin = dp(8);
        root.addView(snoozeRow, snoozeRowParams);

        Button dismissButton = new Button(this);
        dismissButton.setText("Dismiss");
        dismissButton.setOnClickListener(v -> dismiss());
        LinearLayout.LayoutParams dismissParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        );
        dismissParams.topMargin = dp(32);
        root.addView(dismissButton, dismissParams);

        return root;
    }

    private void dismiss() {
        stopRinging();
        finish();
    }

    private void snooze(int minutes) {
        stopRinging();

        Context context = getApplicationContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null && alarmId != null) {
            Intent ringIntent = new Intent(context, AlarmReceiver.class);
            ringIntent.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
            ringIntent.putExtra(AlarmReceiver.EXTRA_TITLE, title);
            ringIntent.putExtra(AlarmReceiver.EXTRA_BODY, body);

            PendingIntent operation = PendingIntent.getBroadcast(
                context, alarmId.hashCode(), ringIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            long fireAt = System.currentTimeMillis() + minutes * 60_000L;
            alarmManager.setAlarmClock(new AlarmManager.AlarmClockInfo(fireAt, operation), operation);
        }

        finish();
    }

    private void markComplete() {
        stopRinging();

        Intent openApp = new Intent(this, MainActivity.class);
        openApp.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openApp.setAction(MainActivity.ACTION_ALARM_COMPLETE);
        openApp.putExtra(AlarmReceiver.EXTRA_ALARM_ID, alarmId);
        startActivity(openApp);

        finish();
    }

    private void stopRinging() {
        stopService(new Intent(this, AlarmForegroundService.class));
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return (int) (value * density);
    }
}

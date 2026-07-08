package com.ottegi.sequenced;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "Calendar",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR }, alias = "calendar")
    }
)
public class CalendarPlugin extends Plugin {

    private static final String CALENDAR_TITLE = "TidalTask";

    @PluginMethod
    public void requestPermission(PluginCall call) {
        requestPermissionForAlias("calendar", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("calendar") == PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void getEvents(PluginCall call) {
        String startStr = call.getString("start");
        String endStr = call.getString("end");
        if (startStr == null || startStr.isEmpty()) {
            call.reject("start is required.");
            return;
        }
        if (endStr == null || endStr.isEmpty()) {
            call.reject("end is required.");
            return;
        }

        if (getPermissionState("calendar") != PermissionState.GRANTED) {
            call.reject("Calendar permission not granted.");
            return;
        }

        try {
            SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Date startDate = dateFormat.parse(startStr);
            Date endDate = dateFormat.parse(endStr);
            long startMillis = startDate.getTime();
            // Make the end date inclusive of the whole day.
            long endMillis = endDate.getTime() + 24L * 60 * 60 * 1000;

            JSObject result = new JSObject();
            result.put("events", queryEvents(startMillis, endMillis));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to read calendar events: " + e.getMessage());
        }
    }

    private JSArray queryEvents(long startMillis, long endMillis) {
        JSArray events = new JSArray();

        Uri.Builder builder = CalendarContract.Instances.CONTENT_URI.buildUpon();
        ContentUris.appendId(builder, startMillis);
        ContentUris.appendId(builder, endMillis);
        Uri uri = builder.build();

        String[] projection = new String[] {
            CalendarContract.Instances.EVENT_ID,
            CalendarContract.Instances.TITLE,
            CalendarContract.Instances.BEGIN,
            CalendarContract.Instances.END,
            CalendarContract.Instances.ALL_DAY,
            CalendarContract.Instances.CALENDAR_DISPLAY_NAME,
            CalendarContract.Instances.CALENDAR_COLOR
        };

        ContentResolver resolver = getContext().getContentResolver();
        try (Cursor cursor = resolver.query(uri, projection, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            if (cursor == null) return events;

            while (cursor.moveToNext()) {
                String calendarDisplayName = cursor.getString(
                    cursor.getColumnIndexOrThrow(CalendarContract.Instances.CALENDAR_DISPLAY_NAME)
                );
                // Exclude the TidalTask calendar so tasks aren't shown twice. Android write-sync
                // isn't implemented yet, but this stays defensive/future-proof.
                if (CALENDAR_TITLE.equals(calendarDisplayName)) continue;

                JSObject event = new JSObject();
                event.put("id", cursor.getString(cursor.getColumnIndexOrThrow(CalendarContract.Instances.EVENT_ID)));
                event.put("title", cursor.getString(cursor.getColumnIndexOrThrow(CalendarContract.Instances.TITLE)));
                event.put("startDate", isoString(cursor.getLong(cursor.getColumnIndexOrThrow(CalendarContract.Instances.BEGIN))));
                event.put("endDate", isoString(cursor.getLong(cursor.getColumnIndexOrThrow(CalendarContract.Instances.END))));
                event.put("isAllDay", cursor.getInt(cursor.getColumnIndexOrThrow(CalendarContract.Instances.ALL_DAY)) != 0);
                event.put("calendarTitle", calendarDisplayName != null ? calendarDisplayName : "");
                event.put("color", hexColor(cursor.getInt(cursor.getColumnIndexOrThrow(CalendarContract.Instances.CALENDAR_COLOR))));
                events.put(event);
            }
        }

        return events;
    }

    private String isoString(long millis) {
        SimpleDateFormat isoFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US);
        isoFormat.setTimeZone(TimeZone.getDefault());
        return isoFormat.format(new Date(millis));
    }

    private String hexColor(int color) {
        return String.format("#%06X", 0xFFFFFF & color);
    }
}

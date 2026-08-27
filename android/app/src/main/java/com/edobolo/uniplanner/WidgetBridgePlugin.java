package com.edobolo.uniplanner;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    public static final String PREFS_NAME = "UniPlannerWidgetPrefs";

    @PluginMethod
    public void updateStats(PluginCall call) {
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        int passedExams = call.getInt("passedExams", 0);
        int totalExams = call.getInt("totalExams", 0);
        int cfu = call.getInt("cfu", 0);
        int totalCfu = call.getInt("totalCfu", 180);
        String average = call.getString("average", "--");
        String nextExam = call.getString("nextExam", "Nessuno");

        editor.putInt("passedExams", passedExams);
        editor.putInt("totalExams", totalExams);
        editor.putInt("cfu", cfu);
        editor.putInt("totalCfu", totalCfu);
        editor.putString("average", average);
        editor.putString("nextExam", nextExam);
        editor.apply();

        // Notify Stats Widgets to update UI
        UniPlannerStatsWidgetProvider.updateAllWidgets(context);

        call.resolve();
    }
}

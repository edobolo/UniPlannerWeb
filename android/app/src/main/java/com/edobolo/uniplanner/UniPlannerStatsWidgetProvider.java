package com.edobolo.uniplanner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

public class UniPlannerStatsWidgetProvider extends AppWidgetProvider {

    public static void updateAllWidgets(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName widgetComponent = new ComponentName(context, UniPlannerStatsWidgetProvider.class);
        int[] widgetIds = manager.getAppWidgetIds(widgetComponent);
        for (int id : widgetIds) {
            updateWidget(context, manager, id);
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS_NAME, Context.MODE_PRIVATE);

        int passedExams = prefs.getInt("passedExams", 0);
        int totalExams = prefs.getInt("totalExams", 0);
        int cfu = prefs.getInt("cfu", 0);
        int totalCfu = prefs.getInt("totalCfu", 180);
        String average = prefs.getString("average", "--");

        int percent = (totalExams > 0) ? (int) Math.round(((double) passedExams / totalExams) * 100) : 0;

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.stats_widget_layout);

        views.setTextViewText(R.id.widget_passed_exams, String.valueOf(passedExams));
        views.setTextViewText(R.id.widget_total_exams, "/ " + totalExams + " Esami Superati");
        views.setTextViewText(R.id.widget_percent_text, percent + "%");
        views.setProgressBar(R.id.widget_progress_bar, 100, percent, false);
        views.setTextViewText(R.id.widget_avg_text, "⭐ Media: " + average);
        views.setTextViewText(R.id.widget_cfu_text, "🎯 CFU: " + cfu + " / " + totalCfu);

        // Tap on widget opens Statistiche/Voti tab
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("uniplanner://open?tab=statistiche"), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                201,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.stats_widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}

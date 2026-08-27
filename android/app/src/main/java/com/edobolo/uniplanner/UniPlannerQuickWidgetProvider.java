package com.edobolo.uniplanner;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class UniPlannerQuickWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quick_widget_layout);

        // 1. Orario Lezioni
        views.setOnClickPendingIntent(R.id.widget_btn_schedule, createTabPendingIntent(context, "orario", 101));

        // 2. Timer Pomodoro
        views.setOnClickPendingIntent(R.id.widget_btn_timer, createTabPendingIntent(context, "pomodoro", 102));

        // 3. Piano Esami
        views.setOnClickPendingIntent(R.id.widget_btn_exams, createTabPendingIntent(context, "esami", 103));

        // 4. Assistente AI
        views.setOnClickPendingIntent(R.id.widget_btn_ai, createTabPendingIntent(context, "ai-assistant", 104));

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private PendingIntent createTabPendingIntent(Context context, String tab, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("uniplanner://open?tab=" + tab), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}

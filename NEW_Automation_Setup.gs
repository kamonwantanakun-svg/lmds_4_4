function dailyDeepClean() {
    // Code for daily deep clean action
}

function healthChecks() {
    // Code for health check actions
}

function logCleanup() {
    // Code for log cleanup actions
}

function triggerManagement() {
    // Code for trigger management actions
}

function setupTriggers() {
    ScriptApp.newTrigger('dailyDeepClean')
        .timeBased()
        .everyDays(1)
        .atHour(1) // Runs daily at 1 AM
        .create();
    
    ScriptApp.newTrigger('healthChecks')
        .timeBased()
        .everyDays(1)
        .atHour(2) // Runs daily at 2 AM
        .create();
    
    ScriptApp.newTrigger('logCleanup')
        .timeBased()
        .everyDays(1)
        .atHour(3) // Runs daily at 3 AM
        .create();
    
    ScriptApp.newTrigger('triggerManagement')
        .timeBased()
        .everyDays(1)
        .atHour(4) // Runs daily at 4 AM
        .create();
}

setupTriggers();
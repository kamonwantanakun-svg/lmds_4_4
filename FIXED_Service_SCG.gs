// FIXED_Service_SCG.gs

// This function initializes the fixed headers for the service SCG
function initializeFixedHeaders() {
    const headers = [
        'Service Name',
        'Service Code',
        'Description',
        'Frequency',
        'Provider',
        'Cost',
        'Contact'
    ];
    return headers;
}

// This function clears the input sheet
function clearInputSheet(sheet) {
    const range = sheet.getDataRange();
    range.clearContent(); // Clears only the content, keeping the formatting
}

// Example usage
function setup() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const headers = initializeFixedHeaders();
    sheet.appendRow(headers); // Append fixed headers to the sheet
    clearInputSheet(sheet); // Call to clear the input sheet
}
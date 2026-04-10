// Data validation functions

/**
 * Validate UUID
 * @param {string} uuid - The UUID string to validate.
 * @returns {boolean} - Returns true if valid, otherwise false.
 */
function validateUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validate coordinates
 * @param {number} latitude - Latitude to validate.
 * @param {number} longitude - Longitude to validate.
 * @returns {boolean} - Returns true if valid, otherwise false.
 */
function validateCoordinates(latitude, longitude) {
    return (latitude >= -90 && latitude <= 90) && (longitude >= -180 && longitude <= 180);
}

/**
 * Validate name
 * @param {string} name - The name to validate.
 * @returns {boolean} - Returns true if valid, otherwise false.
 */
function validateName(name) {
    return typeof name === 'string' && name.trim().length > 0;
}

/**
 * Validate email
 * @param {string} email - The email string to validate.
 * @returns {boolean} - Returns true if valid, otherwise false.
 */
function validateEmail(email) {
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
}

/**
 * Validate postcode
 * @param {string} postcode - The postcode string to validate.
 * @returns {boolean} - Returns true if valid, otherwise false.
 */
function validatePostcode(postcode) {
    const postcodeRegex = /^\d{5}(-\d{4})?$/;  // US ZIP code format
    return postcodeRegex.test(postcode);
}

/**
 * Validate entire sheet data
 * @param {Array<Object>} sheetData - Array of objects representing rows in the sheet.
 * @returns {boolean} - Returns true if all rows are valid, otherwise false.
 */
function validateSheet(sheetData) {
    return sheetData.every(row => {
        return validateUUID(row.uuid) && 
               validateCoordinates(row.latitude, row.longitude) && 
               validateName(row.name) && 
               validateEmail(row.email) && 
               validatePostcode(row.postcode);
    });
}
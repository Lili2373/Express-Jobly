/**
 * Generate SQL for partial updates based on provided data.
 * 
 * This function constructs the SET clause of a SQL UPDATE statement and extracts
 * the corresponding values to be updated based on the provided data. It takes an
 * object representing the data to be updated and a mapping object to convert 
 * JavaScript property names to their corresponding column names in the database.
 * 
 * @param {Object} dataToUpdate - An object containing the data to be updated.
 * @param {Object} jsToSql - An object mapping JavaScript property names to 
 *                            their corresponding column names in the database.
 * @returns {Object} An object containing:
 *                   - `setCols`: A string representing the SET clause of the SQL query.
 *                   - `values`: An array containing the values extracted from the dataToUpdate object.
 * @throws {BadRequestError} Throws a BadRequestError if no data is provided for updating.
 */
const { BadRequestError } = require("../expressError");

// Function for generating SQL for partial updates
function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);
  // Throw error if no data is provided for updating
  if (keys.length === 0) throw new BadRequestError("No data");

  // Map dataToUpdate keys to SQL set clauses
  const cols = keys.map((colName, idx) =>
    `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  // Return SQL set clauses and values
  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };

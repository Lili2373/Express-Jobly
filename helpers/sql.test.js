
const { sqlForPartialUpdate } = require('./sql.js');
const { BadRequestError } = require('../expressError');

describe('sqlForPartialUpdate', () => {
    it('should generate SQL for partial updates', () => {
        const dataToUpdate = { firstName: 'Alice', age: 30 };
        const jsToSql = { firstName: 'first_name' };

        const result = sqlForPartialUpdate(dataToUpdate, jsToSql);

        expect(result.setCols).toEqual('"first_name"=$1, "age"=$2');
        expect(result.values).toEqual(['Alice', 30]);
    });

    it('should throw BadRequestError if no data is provided for updating', () => {
        const dataToUpdate = {};
        const jsToSql = {};

        expect(() => {
            sqlForPartialUpdate(dataToUpdate, jsToSql);
        }).toThrowError(BadRequestError);
    });
});

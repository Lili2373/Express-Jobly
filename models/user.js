"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, is_admin }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
      `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
      [username],
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register(
    { username, password, firstName, lastName, email, isAdmin }) {
    const duplicateCheck = await db.query(
      `SELECT username
           FROM users
           WHERE username = $1`,
      [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
      `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            is_admin)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING username, first_name AS "firstName", last_name AS "lastName", email, is_admin AS "isAdmin"`,
      [
        username,
        hashedPassword,
        firstName,
        lastName,
        email,
        isAdmin,
      ],
    );

    const user = result.rows[0];

    return user;
  }

  /** Find all users.
   *
   * Returns [{ username, first_name, last_name, email, is_admin }, ...]
   **/

  static async findAll() {
    const result = await db.query(
      `SELECT username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           ORDER BY username`,
    );

    return result.rows;
  }


  /** Apply for a job.
   *
   * Updates the database to associate the job with the user.
   *
   * - username: the username of the user applying for the job
   * - jobId: the ID of the job to apply for
   *
   * Returns undefined.
   *
   * Throws NotFoundError if the user or job is not found.
   **/
  static async applyForJob(username, jobId) {
    // Check if the user exists
    const userRes = await db.query(
      `SELECT username FROM users WHERE username = $1`,
      [username]
    );
    const user = userRes.rows[0];
    if (!user) throw new NotFoundError(`No user: ${username}`);

    // Check if the job exists
    const jobRes = await db.query(
      `SELECT id FROM jobs WHERE id = $1`,
      [jobId]
    );
    const job = jobRes.rows[0];
    if (!job) throw new NotFoundError(`No job with id: ${jobId}`);

    // Associate the job with the user in the database
    await db.query(
      `INSERT INTO applications (username, job_id)
       VALUES ($1, $2)`,
      [username, jobId]
    );
  }

  /** Given a username, return data about user including applied jobs.
   *
   * Returns { username, firstName, lastName, email, isAdmin, jobs }
   *   where jobs is an array of job IDs the user has applied for.
   *
   * Throws NotFoundError if user not found.
   **/
  static async get(username) {
    const userRes = await db.query(
      `SELECT u.username,
              u.first_name AS "firstName",
              u.last_name AS "lastName",
              u.email,
              u.is_admin AS "isAdmin",
              ARRAY_AGG(a.job_id) AS jobs
       FROM users AS u
       LEFT JOIN applications AS a ON u.username = a.username
       WHERE u.username = $1
       GROUP BY u.username`,
      [username]
    );

    const user = userRes.rows[0];
    if (!user) throw new NotFoundError(`No user: ${username}`);

    return user;
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email, isAdmin }
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    }

    const { setCols, values } = sqlForPartialUpdate(
      data,
      {
        firstName: "first_name",
        lastName: "last_name",
        isAdmin: "is_admin",
      });
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email,
                                is_admin AS "isAdmin"`;
    const result = await db.query(querySql, [...values, username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    delete user.password;
    return user;
  }

  /** Delete given user from database; returns undefined. */

  static async remove(username) {
    let result = await db.query(
      `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
      [username],
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }

  /** Apply for a job.
   *
   * Updates the database to associate the job with the user.
   *
   * - username: the username of the user applying for the job
   * - jobId: the ID of the job to apply for
   *
   * Returns undefined.
   *
   * Throws NotFoundError if the user or job is not found.
   **/
  static async applyForJob(username, jobId) {
    // Check if the user exists
    const userRes = await db.query(
      `SELECT username FROM users WHERE username = $1`,
      [username]
    );
    const user = userRes.rows[0];
    if (!user) throw new NotFoundError(`No user: ${username}`);

    // Check if the job exists
    const jobRes = await db.query(
      `SELECT id FROM jobs WHERE id = $1`,
      [jobId]
    );
    const job = jobRes.rows[0];
    if (!job) throw new NotFoundError(`No job with id: ${jobId}`);

    // Associate the job with the user in the database
    await db.query(
      `INSERT INTO applications (username, job_id)
       VALUES ($1, $2)`,
      [username, jobId]
    );
  }

}
module.exports = User;

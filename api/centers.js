const express = require("express");
const {
  query,
  validationResult,
  matchedData,
  param,
  body,
} = require("express-validator");
const knex = require("../db/knex"); //the connection
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.get(
  "/:centerID",
  [param("centerID").isInt().toInt()],
  async (req, res) => {
    try {
      const { centerID } = matchedData(req);
      console.log(centerID, "req");
      var centerQuery = knex("centers")
        .select(
          "centers.id",
          "centers.adress",
          "centers.cif",
          "centers.city",
          "centers.controlDigit",
          "centers.denomination",
          "centers.master",
          "centers.masterDNI",
          "centers.maxPrice",
          "centers.minPrice",
          "centers.name",
          "centers.postalCode",
          "centers.provinceNumber",
          "centers.sectionNumber",
          "centers.created_at",
          "centers.updated_at"
        )

        .where("centers.id", centerID)
        .first()
        // SELECCIONAR ROL?
        .leftJoin("user_rols as rol", "centers.id", "rol.idEntity")
        .where("centers.id", centerID)
        .first();

      const rolQuery = knex("user_rols")
        .leftJoin("users", "users.id", "user_rols.idUser")
        .select("role", "idUser")
        .where("idEntity", centerID)
        .first();

      return Promise.all([centerQuery, rolQuery])
        .then(([center, rol]) => {
          console.log(center, "centro");
          if (!center) {
            return res.status(401).send("Not found");
          }
          center["rol"] = rol;
          return res.json(center);
        })
        .catch((error) => {
          console.log(error);
          return res.status(500).send("Error");
        });
    } catch (error) {
      console.log(error);
      return res.status(500).send("Error");
    }
  }
);

router.get(
  "/",
  // defaultGetValidators,
  (req, res) => {
    const query = knex("centers")
      // HAY QUE SUMAR EL NUMERO DE ALUMNOS EN CADA CENTRO. ACTIVOS E INACTIVOS
      //   .leftJoin(
      //     "students",
      //     "student.id",
      //     "students.idCenter"
      //   )
      .select(
        "centers.id",
        "centers.adress",
        "centers.cif",
        "centers.city",
        "centers.controlDigit",
        "centers.denomination",
        "centers.master",
        "centers.masterDNI",
        "centers.maxPrice",
        "centers.minPrice",
        "centers.name",
        "centers.postalCode",
        "centers.provinceNumber",
        "centers.sectionNumber",
        "centers.created_at",
        "centers.updated_at"
        // "centers.numberOthers",
        // "centers.numberStudents"
      )
      .then((results) => {
        return res.json({
          results,
        });
      })
      .catch((error) => res.status(500).send(JSON.stringify(error)));

    // return Promise.all([query, countQuery])
    //   .then(([results, count]) => {
    //     return res.json({
    //       page: criteria.page || 1,
    //       perPage: criteria.perPage || 10,
    //       totalResults: count.totalResults,
    //       results,
    //     });
    //   })
    //   .catch((error) => res.status(500).send(JSON.stringify(error)));
  }
);

// CREAR CENTER
router.post(
  "/",
  [
    body("name"),
    body("email"),
    body("minPrice"),
    body("maxPrice"),
    body("denomination"),
    body("adress"),
    body("postalCode"),
    body("city"),
    body("master"),
    body("masterDNI"),
    body("cif"),
    body("provinceNumber"),
    body("sectionNumber"),
    body("controlDigit"),
    body("password"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    console.log(data, "center");
    bcrypt.genSalt(10).then((salt, err) => {
      if (err) {
        this.logger.logError(err, "registerUser");

        reject(err);
      }

      bcrypt.hash(data.password, salt).then((hash, err) => {
        if (err) {
          this.logger.logError(err, "registerUser");

          reject(err);
        }

        var centerQuery = new Promise((resolve) => {
          knex("centers")
            .insert({
              name: data.name,
              minPrice: data.minPrice,
              maxPrice: data.maxPrice,
              denomination: data.denomination,
              adress: data.adress,
              postalCode: data.postalCode,
              city: data.city,
              master: data.master,
              masterDNI: data.masterDNI,
              cif: data.cif,
              provinceNumber: data.provinceNumber,
              sectionNumber: data.sectionNumber,
              controlDigit: data.controlDigit,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .then((centerID) => {
              console.log(centerID, "id del centro");
              resolve(centerID);
            })
            .catch((error) => {
              console.log("no lo ha guardado por fallo del center");
              resolve();
            });
        });

        console.log(hash, "contrasena");

        var userQuery = new Promise((resolve) => {
          knex("users")
            .insert({
              user: data.email,
              password: hash,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .then((userID) => {
              console.log(userID, "id del user");
              resolve(userID);
            })
            .catch((error) => {
              console.log("no lo ha guardado por fallo del user");
              resolve();
            });
        });
        console.log(userQuery, "userQuery");
        // Cuando las anteriores se han creado, meter el id del usuario en idUser, y el id del centro en idEntity

        return Promise.all([centerQuery, userQuery]).then((results) => {
          console.log(results, "resultados finales");

          knex("user_rols")
            .insert({
              idUser: results[1], // falta conseguir este dato
              idEntity: results[0], // falta conseguir este dato
              role: "ROLE_CENTER",
              created_at: new Date(),
              updated_at: new Date(),
            })
            .then((response) => {
              return res.json({
                results: response,
              });
            });
        });
      });
    });
  }
);

// EDIT
router.post(
  "/:ID",
  [
    param("ID").isInt().toInt(),
    body("name"),
    body("email"),
    body("minPrice"),
    body("maxPrice"),
    body("denomination"),
    body("adress"),
    body("postalCode"),
    body("city"),
    body("master"),
    body("masterDNI"),
    body("cif"),
    body("provinceNumber"),
    body("sectionNumber"),
    body("controlDigit"),
    body("password"),
    body("identityID"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    if (data.password) {
      bcrypt.genSalt(10).then((salt, err) => {
        if (err) {
          this.logger.logError(err, "registerUser");

          reject(err);
        }

        bcrypt.hash(data.password, salt).then((hash, err) => {
          if (err) {
            this.logger.logError(err, "registerUser");

            reject(err);
          }

          var centerQuery = new Promise((resolve) => {
            knex("centers")
              .update({
              name: data.name,
              minPrice: data.minPrice,
              maxPrice: data.maxPrice,
              denomination: data.denomination,
              adress: data.adress,
              postalCode: data.postalCode,
              city: data.city,
              master: data.master,
              masterDNI: data.masterDNI,
              cif: data.cif,
              provinceNumber: data.provinceNumber,
              sectionNumber: data.sectionNumber,
              controlDigit: data.controlDigit,
              updated_at: new Date(),
              })
              .where("id", data.ID)
              .then((result) => {
                if (result > 0) {
                  return res.send("Updated");
                }
                return res.status(404).send("Not found");
              })
              .catch((err) => {
                return res.status(500).send(err);
              });
          });

          var userQuery = new Promise((resolve) => {
            knex("users")
              .update({
                // pasar para el user a coger la inicial del nombre y el priemr apellido
                user: data.email,
                password: hash,
                created_at: new Date(),
                updated_at: new Date(),
              })
              .where("id", data.identityID)
              .then((userID) => {
                console.log(userID, "id del user");
                resolve(userID);
              })
              .catch((error) => {
                console.log("no lo ha guardado por fallo del user");
                resolve();
              });
          });
        });
      });
    } else {
      var centerQuery = new Promise((resolve) => {
        knex("centers")
          .update({
            name: data.name,
              minPrice: data.minPrice,
              maxPrice: data.maxPrice,
              denomination: data.denomination,
              adress: data.adress,
              postalCode: data.postalCode,
              city: data.city,
              master: data.master,
              masterDNI: data.masterDNI,
              cif: data.cif,
              provinceNumber: data.provinceNumber,
              sectionNumber: data.sectionNumber,
              controlDigit: data.controlDigit,
              updated_at: new Date(),
          })
          .where("id", data.ID)
          .then((result) => {
            if (result > 0) {
              return res.send("Updated");
            }
            return res.status(404).send("Not found");
          })
          .catch((err) => {
            return res.status(500).send(err);
          });
      });

      var userQuery = new Promise((resolve) => {
        knex("users")
          .update({
            user: data.email,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .where("id", data.identityID)
          .then((userID) => {
            console.log(userID, "id del user");
            resolve(userID);
          })
          .catch((error) => {
            console.log("no lo ha guardado por fallo del user");
            resolve();
          });
      });
    }


    return Promise.all([centerQuery, userQuery]).then((results) => {
      console.log(results, "resultados finales");
      return res.json({
        results: results,
      });
    });
  }
);

// DELETE
router.delete("/:ID", [param("ID").isInt().toInt()], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }

  const { ID } = matchedData(req, { includeOptionals: true });

  knex("centers")
    .where({
      id: ID,
    })
    .del()
    .then((value) => {
      if (value > 0) {
        return res.send("OK");
      }
      return res.status(404).send("Not found");
    })
    .catch((error) => {
      return res.status(500).send(error);
    });
});

module.exports = router;

const express = require("express");
const {
  query,
  validationResult,
  matchedData,
  param,
  body,
} = require("express-validator");
const knex = require("../db/knex"); //the connection
const moment = require("moment");

const router = express.Router();

// TODOS LOS EXAMENES DE UN CENTRO
router.get(
  "/",
  [
    query("centerID").optional(),
    query("search").optional(),
    query("orderBy").optional({ nullable: true }),
    query("orderDir").isIn(["asc", "desc"]).optional({ nullable: true }),
    query("perPage").isInt({ min: 1, max: 100 }).toInt().optional(),
    query("page").isInt({ min: 1 }).toInt().optional(),
  ],
  // defaultGetValidators,
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    var {
      centerID = null,
      orderBy = null,
      orderDir = null,
      perPage = 10,
      page = 1,
    } = req.query;

    var getQuery = knex.table("exams").orderBy("exams.created_at", "desc");

    if (centerID) {
      getQuery.where("exams.idCenter", centerID);
    }

    var totalCount = await getQuery
      .clone()
      .count("*", { as: "totalResults" })
      .limit(999999)
      .offset(0);

    var results = await getQuery
      .limit(perPage)
      .offset((page - 1) * perPage)
      .leftJoin("centers", "centers.id", "exams.idCenter")
      .select({
        id: "exams.id",
        registerNumber: "exams.registerNumber",
        type: "exams.type",
        date: "exams.date",
        idCenter: "exams.idCenter",
        centerName: "centers.name",
      });

    return res.json({
      page: page || 1,
      perPage: perPage || 10,
      totalCount: totalCount[0].totalResults,
      results: results,
    });
  }
);

// GET ONE EXAM
router.get("/:examID", [param("examID").isInt().toInt()], async (req, res) => {
  try {
    const { examID } = matchedData(req);
    var examQuery = knex("exams")
      .leftJoin("centers", "centers.id", "exams.idCenter")
      .select(
        "exams.id",
        "exams.date",
        "exams.registerNumber",
        "exams.idCenter",
        "exams.type",
        "centers.name as centerName"
      )
      .where("exams.id", examID)
      .first()
      .then((result) => {
        return res.json(result);
      })
      .catch((error) => {
        console.log(error);
        return res.status(500).send("Error");
      });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Error");
  }
});

// GET STUDENTS FOR 1 THEORY EXAM
router.get(
  "/theory-students/:examID",
  [param("examID").isInt().toInt()],
  async (req, res) => {
    try {
      const { examID } = matchedData(req);
      console.log(examID, "examen");

      var studentsQuery = knex("students")
        .select(
          "students.id as id",
          "students.firstName",
          "students.lastName1",
          "students.lastName2",
          "student_exams.firstTime",
          "student_exams.postponed",
          "student_exams.result"
        )
        .leftJoin("student_exams", "student_exams.idStudent", "students.id")
        // .lefJoin("exams", "exams.id", "student_exams.idExam")
        .where("student_exams.idExam", examID)
        .then((result) => {
          const formatedResult = result.map((elem, index) => {
            elem.number = index + 1;
            elem.studentName = `${elem.firstName} ${elem.lastName1} ${elem.lastName2}`;
            if (elem.postponed) {
              elem["type"] = "Pendiente";
            } else {
              if (elem.firstTime) {
                elem["type"] = "Nuevo";
              } else {
                elem["type"] = "Repetidor";
              }
            }
            return elem;
          });
          return res.json(formatedResult);
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

// GET STUDENTS FOR 1 PRACTICAL EXAM
router.get(
  "/practial-students/:examID",
  [param("examID").isInt().toInt()],
  async (req, res) => {
    try {
      const { examID } = matchedData(req);
      console.log(examID, "examen");

      var studentsQuery = knex("students")
        .select(
          "students.id as id",
          "students.firstName",
          "students.lastName1",
          "students.lastName2",
          "teachers.firstName as teacherFirstName",
          "teachers.lastName1 as teacherLastName1",
          "teachers.lastName2 as teacherLastName2",
          "vehicles.enrollment",
          "student_exams.result"
        )
        .leftJoin("student_exams", "student_exams.idStudent", "students.id")
        .leftJoin("teachers", "teachers.id", "student_exams.idTeacher")
        .leftJoin("vehicles", "vehicles.id", "student_exams.idVehicle")
        // .lefJoin("exams", "exams.id", "student_exams.idExam")
        .where("student_exams.idExam", examID)
        .then((result) => {
          const formatedResult = result.map((elem, index) => {
            elem.number = index + 1;
            elem.studentName = `${elem.firstName} ${elem.lastName1} ${elem.lastName2}`;
            elem.teacherName = `${elem.teacherFirstName} ${elem.teacherLastName1} ${elem.teacherLastName2}`;

            return elem;
          });
          return res.json(formatedResult);
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

// EDIT 1 STUDENT RESULT
router.post(
  "/edit-student-result/:examID",
  [param("examID").isInt().toInt(), body("result"), body("studentID")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    const { examID, studentID, result } = data;

    console.log(examID, studentID, result, "me viene");

    const examStudent = await knex("student_exams")
      .where("student_exams.idStudent", studentID)
      .andWhere("student_exams.idExam", examID)
      .first()
      .then((result) => {
        return result;
      });

    const exam = await knex("exams")
      .where("exams.id", examID)
      .first()
      .then((result) => {
        return result;
      });

    const student = await knex("students")
      .select()
      .where("students.id", studentID)
      .first()
      .then((result) => {
        return result;
      });

    const course = await knex("courses")
      .where("courses.idStudent", studentID)
      .first()
      .then((result) => {
        return result;
      });

    // console.log(examStudent, student, exam, "examen");

    if (examStudent.result === "Apto" && result === "Apto") {
      console.log("entra en apto");

      if (exam.type === "Teórico") {
        const adviceDate = moment(new Date()).add(6, "months").format();
        console.log(adviceDate, "dia de felicitacion");
        console.log(exam.date, "fecha del examen");
        await knex("courses")
          .update({
            theory: exam.date,
            practiceAdvice: adviceDate,
          })
          .where("courses.id", course.id)
          .then((result) => {
            console.log("guarda teorico");
            // Mandar sms de felicitacion
          });
      } else {
        const congratulationDate = moment(new Date()).add(1, "years");
        await knex("courses")
          .update({
            practice: exam.date,
            practiceAdvice: congratulationDate,
          })
          .where("courses.id", course.id)
          .then((result) => {
            console.log("hecho");
          });
      }
    }

    return await knex("student_exams")
      .where("student_exams.idStudent", studentID)
      .andWhere("student_exams.idExam", examID)
      .update({
        result: result,
      })
      .then((result) => {
        return res.json({ result: "hecho" });
      });
  }
);

// CREAR EXAM
router.post(
  "/",
  [body("date").toDate(), body("type"), body("centerID")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });
    knex("exams")
      .insert({
        registerNumber: moment(new Date()).format("YYYYMMDD"),
        idCenter: data.centerID,
        type: data.type,
        date: data.date,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .then(([newID]) => {
        return res.json({ newID });
      })
      .catch((err) => {
        return res.status(500).send(err);
      });
  }
);

// EDIT EXAM
router.post(
  "/edit-exam/:examID",
  [param("examID").isInt().toInt(), body("registerNumber"), body("date").toDate()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    knex("exams")
      .update({
        registerNumber: data.registerNumber,
        date: moment(data.date).format("YYYY-MM-DD"),
        updated_at: new Date(),
      })
      .where("id", data.examID)
      .then((result) => {
        if (result > 0) {
          return res.send(`Updated`);
        }
        return res.status(404).send("Not found");
      })
      .catch((err) => {
        return res.status(500).send(err);
      });
  }
);

const generateForNewStudents = (newStudents, examID) => {
  newStudents.forEach(async (student) => {
    // BUSCO TARIFA PARA SABER PRECIOS
    const tariff = await knex("courses")
      .leftJoin("tariffs", "tariffs.id", "courses.idTariff")
      .select(
        "tariffs.pvpFirstProcedure",
        "tariffs.pvpRate",
        "tariffs.pvpFirstTheoricExam"
      )
      .where("courses.idStudent", student.id)
      .first()
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return "No se encuentra";
      });

    await knex("student_exams")
      .insert({
        idExam: examID,
        idStudent: student.id,
        firstTime: 1,
        result: "----",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .then((result) => {
        console.log("Se guarda el examen");
      });

    const payments = [
      {
        idStudent: student.id,
        description: "Primera Tramitación",
        quantity: tariff.pvpFirstProcedure,
        type: "Cargo",
        date: new Date(),
        paymentType: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        idStudent: student.id,
        description: "Tasas",
        quantity: tariff.pvpRate,
        type: "Cargo",
        date: new Date(),
        paymentType: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        idStudent: student.id,
        description: "Primer Examen Teórico",
        quantity: tariff.pvpFirstTheoricExam,
        type: "Cargo",
        date: new Date(),
        paymentType: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await knex("payments")
      .insert(payments)
      .then((result) => console.log("se guardan los pagos"))
      .catch((result) => console.log("NO se guardan los pagos"));
  });
};
const generateForRepeatStudents = (newStudents, examID) => {
  newStudents.forEach(async (student) => {
    // BUSCO TARIFA PARA SABER PRECIOS
    const tariff = await knex("courses")
      .leftJoin("tariffs", "tariffs.id", "courses.idTariff")
      .select(
        "tariffs.pvpRate",
        "tariffs.pvpTheoricExam",
        "tariffs.pvpProcedure"
      )
      .where("courses.idStudent", student.id)
      .first()
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return "No se encuentra";
      });

    await knex("student_exams")
      .insert({
        idExam: examID,
        idStudent: student.id,
        firstTime: 0,
        result: "----",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .then((result) => {
        console.log("Se guarda el examen");
      });

    const theoryExams = await knex("student_exams")
      .leftJoin("exams", "exams.id", "student_exams.idExam")
      .where("exams.type", "Teórico")
      .andWhere("student_exams.result", "NO APTO")
      .andWhere("idStudent", student.id)
      .count("* as sum")
      .then((result) => {
        return result[0].sum;
      });

    const practicalExams = await knex("student_exams")
      .leftJoin("exams", "exams.id", "student_exams.idExam")
      .where("exams.type", "Práctico")
      .andWhere("student_exams.result", "NO APTO")
      .andWhere("idStudent", student.id)
      .count("* as sum")
      .then((result) => {
        return result[0].sum;
      });

    console.log(theoryExams, practicalExams, "theory");

    if ((theoryExams + practicalExams) % 2) {
      const payments = [
        {
          idStudent: student.id,
          description: "Tramitación expediente",
          quantity: tariff.pvpProcedure,
          type: "Cargo",
          date: new Date(),
          paymentType: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          idStudent: student.id,
          description: "Tasas",
          quantity: tariff.pvpRate,
          type: "Cargo",
          date: new Date(),
          paymentType: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          idStudent: student.id,
          description: "Examen Teórico",
          quantity: tariff.pvpTheoricExam,
          type: "Cargo",
          date: new Date(),
          paymentType: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      await knex("payments")
        .insert(payments)
        .then((result) => console.log("se guardan los pagos"))
        .catch((result) => console.log("NO se guardan los pagos"));
    } else {
      await knex("payments")
        .insert({
          idStudent: student.id,
          description: "Examen Teórico",
          quantity: tariff.pvpTheoricExam,
          type: "Cargo",
          date: new Date(),
          paymentType: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .then((result) => console.log("se guardan los pagos"))
        .catch((result) => console.log("NO se guardan los pagos"));
    }
  });
};

const generateForPendingStudents = (newStudents, examID) => {
  newStudents.forEach(async (student) => {
    // BUSCO TARIFA PARA SABER PRECIOS
    const tariff = await knex("courses")
      .leftJoin("tariffs", "tariffs.id", "courses.idTariff")
      .select(
        "tariffs.pvpFirstProcedure",
        "tariffs.pvpRate",
        "tariffs.pvpFirstTheoricExam"
      )
      .where("courses.idStudent", student.id)
      .first()
      .then((result) => {
        return result;
      })
      .catch((err) => {
        return "No se encuentra";
      });

    await knex("student_exams")
      .insert({
        idExam: examID,
        idStudent: student.id,
        postponed: 1,
        result: "----",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .then((result) => {
        console.log("Se guarda el examen");
      });
  });
};

// GUARDAR ALUMNOS EN TEORICO
router.post(
  "/store-theory-students",
  [body("students"), body("examID")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    const {
      idCenter = null,
      newStudents = [],
      repeatStudents = [],
      pendingStudents = [],
    } = data.students;

    const { examID } = data;

    console.log(idCenter, "cntro");
    console.log(newStudents, "nuevos");
    console.log(repeatStudents, "repetidores");
    console.log(pendingStudents, "pendientes");
    console.log(examID, "examen");

    await generateForNewStudents(newStudents, examID);
    await generateForRepeatStudents(repeatStudents, examID);
    await generateForPendingStudents(pendingStudents, examID);

    return res.json({ result: "Todo correcto" });
  }
);

// GUARDAR ALUMNOS EN PRACTICO
router.post(
  "/store-practical-students",
  [body("sessions"), body("examID")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    const data = matchedData(req, { includeOptionals: true });

    const { sessions = [], examID } = data;

    console.log(sessions, examID);

    await sessions.forEach(async (session) => {
      session.students.forEach(async (student) => {
        await knex("student_exams")
          .insert({
            idExam: examID,
            idTeacher: session.teacherID,
            idStudent: student.id,
            idVehicle: session.vehicleID,
            result: "----",
          })
          .then((res) => console.log(res));

        const tariff = await knex("courses")
          .leftJoin("tariffs", "tariffs.id", "courses.idTariff")
          .select(
            "tariffs.pvpFirstProcedure",
            "tariffs.pvpRate",
            "tariffs.pvpProcedure",
            "tariffs.pvpPracticalExam"
          )
          .where("courses.idStudent", student.id)
          .first()
          .then((result) => {
            return result;
          })
          .catch((err) => {
            return "No se encuentra";
          });

        const theoryExams = await knex("student_exams")
          .leftJoin("exams", "exams.id", "student_exams.idExam")
          .where("exams.type", "Teórico")
          .andWhere("student_exams.result", "NO APTO")
          .andWhere("idStudent", student.id)
          .count("* as sum")
          .then((result) => {
            return result[0].sum;
          });

        const practicalExams = await knex("student_exams")
          .leftJoin("exams", "exams.id", "student_exams.idExam")
          .where("exams.type", "Práctico")
          .andWhere("student_exams.result", "NO APTO")
          .andWhere("idStudent", student.id)
          .count("* as sum")
          .then((result) => {
            return result[0].sum;
          });

        let payments = [];

        if (theoryExams + practicalExams == 0) {
          const payment1 = [
            {
              idStudent: student.id,
              description: "Primera Tramitación",
              quantity: tariff.pvpFirstProcedure,
              type: "Cargo",
              date: new Date(),
              paymentType: null,
            },
            {
              idStudent: student.id,
              description: "Tasas",
              quantity: tariff.pvpRate,
              type: "Cargo",
              date: new Date(),
              paymentType: null,
            },
          ];

          payments = payments.concat(payment1);
        } else if ((theoryExams + practicalExams) % 2 == 0) {
          const payment2 = [
            {
              idStudent: student.id,
              description: "Tramitación expediente",
              quantity: tariff.pvpProcedure,
              type: "Cargo",
              date: new Date(),
              paymentType: null,
            },
            {
              idStudent: student.id,
              description: "Tasas",
              quantity: tariff.pvpRate,
              type: "Cargo",
              date: new Date(),
              paymentType: null,
            },
          ];

          payments = payments.concat(payment2);
        }

        const payment3 = {
          idStudent: student.id,
          description: "Examen Práctico",
          quantity: tariff.pvpPracticalExam,
          type: "Cargo",
          date: new Date(),
          paymentType: null,
        };

        payments = payments.concat(payment3);

        await knex("payments")
          .insert(payments)
          .then((res) => console.log("se guardan los pagos"));
      });

      // MIrar que hace esto
      //   if ($practice == 0) {
      //     $scb = StudentClassBag::where('idStudent', $student['id'])->first();

      //     if ($student->completeCourse) {
      //         $scb->quantity = $scb->quantity + $tariff->completeClasses;
      //     } else {
      //         $scb->quantity = $scb->quantity + $tariff->simpleClasses;
      //     }
      //     $scb->save();
      // }
    });

    return res.json({ result: "Todo correcto" });
  }
);

module.exports = router;

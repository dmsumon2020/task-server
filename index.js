import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoURI = process.env.MONGO_URI;
const dbName = "taskManager";
const collectionName = "tasks";

//app.use(cors());
app.use(cors({ origin: "*" }));

app.use(express.json());

let db;
let tasksCollection;

// Connect to MongoDB
MongoClient.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then((client) => {
    db = client.db(dbName);
    tasksCollection = db.collection(collectionName);
    console.log("Connected to MongoDB");
  })
  .catch((error) => console.error("MongoDB connection error:", error));

// test db collection
app.get("/test-db", async (req, res) => {
  try {
    await tasksCollection.findOne({});
    res.status(200).json({ message: "Database connection successful" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Database connection failed", error: error.message });
  }
});

// Add a new task
app.post("/tasks", async (req, res) => {
  try {
    const { title, description, status, userId } = req.body;

    if (!title || !userId || !status) {
      return res
        .status(400)
        .json({ message: "Title, Status, and User ID are required" });
    }

    // Get the highest order value for the current status
    const highestOrderTask = await tasksCollection
      .find({ userId, status })
      .sort({ order: -1 })
      .limit(1)
      .toArray();
    const newOrder =
      highestOrderTask.length > 0 ? highestOrderTask[0].order + 1 : 1;

    const newTask = {
      title,
      description,
      status,
      userId,
      order: newOrder,
      createdAt: new Date(),
    };

    const result = await tasksCollection.insertOne(newTask);
    res
      .status(201)
      .json({ message: "Task added successfully", taskId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Error adding task", error });
  }
});

// Retrieve all tasks for a user
app.get("/tasks", async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const tasks = await tasksCollection
      .find({ userId })
      .sort({ order: 1 })
      .toArray();
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving tasks", error });
  }
});

// Retrieve tasks by category
/* app.get("/tasks/category/:category", async (req, res) => {
  try {
    const { userId } = req.query;
    const { category } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const tasks = await tasksCollection
      .find({ userId, status: category })
      .sort({ order: 1 })
      .toArray();
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving tasks", error });
  }
}); */

app.get("/tasks/category/:category", async (req, res) => {
  try {
    const { userId } = req.query;
    const { category } = req.params;
    if (!userId) {
      return res.status(400).json({ message: "User  ID is required" });
    }
    const tasks = await tasksCollection
      .find({ userId, status: category })
      .sort({ order: 1 })
      .toArray();
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error retrieving tasks:", error); // Log the error
    res
      .status(500)
      .json({ message: "Error retrieving tasks", error: error.message });
  }
});

// Update a task
app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, order } = req.body;

    const updateFields = {};
    if (title) updateFields.title = title;
    if (description) updateFields.description = description;
    if (status) updateFields.status = status;
    if (order !== undefined) updateFields.order = order;

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "Task not found or no changes made" });
    }
    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating task", error });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json({ message: "Task status updated" });
  } catch (error) {
    res.status(500).json({ message: "Error updating task status", error });
  }
});

// Reorder tasks within the same column
app.put("/tasks/reorder", async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ message: "Invalid task order data" });
    }

    // Bulk update task positions
    const bulkOps = tasks.map((task, index) => ({
      updateOne: {
        filter: { _id: new ObjectId(task.id) },
        update: { $set: { position: index } },
      },
    }));

    await tasksCollection.bulkWrite(bulkOps);
    res.json({ message: "Task order updated" });
  } catch (error) {
    res.status(500).json({ message: "Error reordering tasks", error });
  }
});

// Delete a task
app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting task", error });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

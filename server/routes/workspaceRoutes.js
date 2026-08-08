import express from "express";
import {
  addMember,
  getUserWorkspaces,
  syncUserWorkspaces,
} from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkspaces);
workspaceRouter.post("/sync", syncUserWorkspaces);
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;

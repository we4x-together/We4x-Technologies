import prisma from "../configs/prisma.js";
import { createClerkClient } from "@clerk/express";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// Get all workspaces for user
export const getUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: userId } },
      },
      include: {
        members: { include: { user: true } },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: { include: { user: true } },
              },
            },
            members: { include: { user: true } },
          },
        },
        owner: true,
      },
    });
    res.json({ workspaces });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};



// Repair/synchronize the current user's Clerk organizations into the local database.
// This is intentionally protected by Clerk auth and uses Clerk as the source of truth.
export const syncUserWorkspaces = async (req, res) => {
  try {
    const { userId } = await req.auth();

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress;

    if (!email) {
      return res.status(400).json({ message: "Your Clerk account does not have an email address." });
    }

    const name =
      clerkUser.fullName ||
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    await prisma.user.upsert({
      where: { id: userId },
      update: {
        email,
        name,
        image: clerkUser.imageUrl || "",
      },
      create: {
        id: userId,
        email,
        name,
        image: clerkUser.imageUrl || "",
      },
    });

    const memberships = await clerkClient.users.getOrganizationMembershipList({
      userId,
      limit: 500,
    });

    for (const membership of memberships.data) {
      const organization = membership.organization;
      if (!organization?.id) continue;

      let ownerId = organization.createdBy || userId;

      // The workspace owner is a required foreign key in our Prisma schema.
      if (ownerId !== userId) {
        try {
          const owner = await clerkClient.users.getUser(ownerId);
          const ownerEmail =
            owner.primaryEmailAddress?.emailAddress ||
            owner.emailAddresses?.[0]?.emailAddress;

          if (ownerEmail) {
            await prisma.user.upsert({
              where: { id: ownerId },
              update: {
                email: ownerEmail,
                name:
                  owner.fullName ||
                  [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
                  ownerEmail.split("@")[0],
                image: owner.imageUrl || "",
              },
              create: {
                id: ownerId,
                email: ownerEmail,
                name:
                  owner.fullName ||
                  [owner.firstName, owner.lastName].filter(Boolean).join(" ") ||
                  ownerEmail.split("@")[0],
                image: owner.imageUrl || "",
              },
            });
          } else {
            ownerId = userId;
          }
        } catch (ownerError) {
          console.warn(`Unable to sync workspace owner ${ownerId}:`, ownerError.message);
          ownerId = userId;
        }
      }

      const slug = organization.slug || organization.id.toLowerCase();

      await prisma.workspace.upsert({
        where: { id: organization.id },
        update: {
          name: organization.name,
          slug,
          image_url: organization.imageUrl || "",
          ownerId,
        },
        create: {
          id: organization.id,
          name: organization.name,
          slug,
          ownerId,
          image_url: organization.imageUrl || "",
        },
      });

      await prisma.workspaceMember.upsert({
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: organization.id,
          },
        },
        update: {
          role: membership.role === "org:admin" ? "ADMIN" : "MEMBER",
        },
        create: {
          userId,
          workspaceId: organization.id,
          role: membership.role === "org:admin" ? "ADMIN" : "MEMBER",
        },
      });
    }

    return res.json({
      message: "Workspaces synchronized successfully",
      count: memberships.data.length,
    });
  } catch (error) {
    console.error("Workspace sync failed:", error);
    return res.status(500).json({ message: error.code || error.message });
  }
};

// Add member to workspace

export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    //check if user exists
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!workspaceId || !role) {
      return res.status(400).json({ message: "Missing required parameters" });
    }
    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    //fetch workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }
    // check creator has admin role
    if (
      !workspace.members.find(
        (member) => member.userId === userId && member.role === "ADMIN",
      )
    ) {
      return res
        .status(401)
        .json({ message: "You do not have admin privileges" });
    }
    // check if user is already a member
    const existingMember = workspace.members.find(
      (member) => member.userId === userId,
    );

    if (existingMember) {
      return res.status(400).json({ message: "User is already a member" });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
        message,
      },
    });
    res.json({ member, message: "Member added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

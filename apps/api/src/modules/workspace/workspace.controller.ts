import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { workspaceService } from "./workspace.service.js";
import { parseAccountIds } from "./workspace.schema.js";

const uid = (req: Request) => req.user!.userId;

export const workspaceController = {
  accounts: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await workspaceService.accounts(uid(req)) });
  }),

  posts: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await workspaceService.posts(uid(req), parseAccountIds(req.query.accounts)) });
  }),

  post: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await workspaceService.post(uid(req), req.params.accountId, req.params.postId) });
  }),

  comments: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.comments(uid(req), req.params.accountId, req.params.postId);
    res.json({ status: "success", data });
  }),

  commentOnPost: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.commentOnPost(uid(req), req.params.accountId, req.params.postId, req.body.message);
    res.status(201).json({ status: "success", data });
  }),

  replyToComment: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.replyToComment(uid(req), req.params.accountId, req.params.commentId, req.body.message);
    res.status(201).json({ status: "success", data });
  }),

  hideComment: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.setCommentHidden(uid(req), req.params.accountId, req.params.commentId, req.body.hidden);
    res.json({ status: "success", data });
  }),

  deleteComment: catchAsync(async (req: Request, res: Response) => {
    await workspaceService.deleteComment(uid(req), req.params.accountId, req.params.commentId);
    res.status(204).send();
  }),

  conversations: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.conversations(uid(req), parseAccountIds(req.query.accounts));
    res.json({ status: "success", data });
  }),

  conversationWith: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.conversationWith(uid(req), req.params.accountId, req.params.personId);
    res.json({ status: "success", data });
  }),

  conversation: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.conversation(uid(req), req.params.accountId, req.params.conversationId);
    res.json({ status: "success", data });
  }),

  sendMessage: catchAsync(async (req: Request, res: Response) => {
    const data = await workspaceService.sendMessage(uid(req), req.params.accountId, req.params.conversationId, req.body.message);
    res.status(201).json({ status: "success", data });
  }),

  suggest: catchAsync(async (req: Request, res: Response) => {
    res.json({ status: "success", data: await workspaceService.suggest(uid(req), req.params.accountId, req.body) });
  }),
};

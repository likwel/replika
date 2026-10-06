import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { connectCatalogSchema, listingSchema, listingUpdateSchema, orderSchema, orderUpdateSchema } from "./marketplace.schema.js";
import { marketplaceService } from "./marketplace.service.js";

// Marketplace : catalogue d'annonces + suivi manuel des commandes (pas de publication automatique)
const router = Router();
router.use(authenticate);

const uid = (req: Request) => req.user!.userId;
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ status: "success", data });

router.get("/stats", catchAsync(async (req, res) => ok(res, await marketplaceService.stats(uid(req)))));

// Catalogue Facebook (Commerce Manager) : découverte, connexion par compte, import des produits
router.get("/accounts", catchAsync(async (req, res) => ok(res, await marketplaceService.catalogStatus(uid(req)))));
router.get("/catalogs", catchAsync(async (req, res) => ok(res, await marketplaceService.listCatalogs(uid(req)))));
router.put(
  "/accounts/:accountId/catalog",
  validate(connectCatalogSchema),
  catchAsync(async (req, res) =>
    ok(
      res,
      await marketplaceService.connectCatalog(
        uid(req),
        req.params.accountId,
        req.body.catalogId ? { catalogId: req.body.catalogId, catalogName: req.body.catalogName ?? req.body.catalogId } : null
      )
    )
  )
);
router.post(
  "/accounts/:accountId/sync",
  catchAsync(async (req, res) => ok(res, await marketplaceService.syncCatalog(uid(req), req.params.accountId)))
);
// Sens inverse : publie les annonces Gescom dans le Catalogue Facebook
router.post(
  "/accounts/:accountId/push",
  catchAsync(async (req, res) => ok(res, await marketplaceService.pushCatalog(uid(req), req.params.accountId)))
);

router.get(
  "/listings",
  catchAsync(async (req, res) => ok(res, await marketplaceService.listListings(uid(req), { accountId: str(req.query.accountId), status: str(req.query.status) })))
);
router.post("/listings", validate(listingSchema), catchAsync(async (req, res) => ok(res, await marketplaceService.createListing(uid(req), req.body), 201)));
router.get("/listings/:id", catchAsync(async (req, res) => ok(res, await marketplaceService.getListing(uid(req), req.params.id))));
router.patch("/listings/:id", validate(listingUpdateSchema), catchAsync(async (req, res) => ok(res, await marketplaceService.updateListing(uid(req), req.params.id, req.body))));
router.delete(
  "/listings/:id",
  catchAsync(async (req, res) => {
    await marketplaceService.removeListing(uid(req), req.params.id);
    res.status(204).send();
  })
);
// Publier une seule annonce vers le Catalogue Facebook
router.post("/listings/:id/push", catchAsync(async (req, res) => ok(res, await marketplaceService.pushListing(uid(req), req.params.id))));
router.post(
  "/listings/:id/orders",
  validate(orderSchema),
  catchAsync(async (req, res) => ok(res, await marketplaceService.createOrder(uid(req), req.params.id, req.body), 201))
);

router.get(
  "/orders",
  catchAsync(async (req, res) => {
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status.split(",") : undefined;
    ok(res, await marketplaceService.listOrders(uid(req), { listingId: str(req.query.listingId), status }));
  })
);
router.patch("/orders/:id", validate(orderUpdateSchema), catchAsync(async (req, res) => ok(res, await marketplaceService.updateOrder(uid(req), req.params.id, req.body))));
router.delete(
  "/orders/:id",
  catchAsync(async (req, res) => {
    await marketplaceService.removeOrder(uid(req), req.params.id);
    res.status(204).send();
  })
);

export default router;

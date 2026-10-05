// backend/routes/market.js
const express  = require("express");
const router   = express.Router();
const { Parcel, Transaction, MarketData } = require("../../database/models");

// ─── GET /api/market ──────────────────────────────────────────────────────────
// Public: land market price insights by county
router.get("/", async (req, res) => {
  try {
    const { county } = req.query;

    // Aggregate average price per county from completed transactions
    const pipeline = [
      { $match: { transactionType: "transfer", status: "confirmed",
          priceKES: { $gt: 0 } } },
      { $group: { _id: "$county", avgPrice: { $avg: "$priceKES" },
          totalSales: { $sum: 1 }, lastSale: { $max: "$timestamp" } } },
      { $sort: { totalSales: -1 } }
    ];

    const marketStats = await Transaction.aggregate(pipeline).exec().catch(() => []);

    // Fallback: pull from MarketData collection (pre-computed)
    const marketData = await MarketData.find(county ? { county: new RegExp(county,"i") } : {})
                                        .sort({ updatedAt: -1 });

    // County breakdown of registered parcels
    const parcelsByCounty = await Parcel.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$county", count: { $sum: 1 },
          avgSize: { $avg: "$sizeAcres" }, avgValue: { $avg: "$estimatedValue" } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success:        true,
      parcelsByCounty,
      marketStats,
      marketData,
      summary: {
        totalApprovedParcels: await Parcel.countDocuments({ status: "approved" }),
        totalCounties:        parcelsByCounty.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/market/trends ───────────────────────────────────────────────────
router.get("/trends", async (req, res) => {
  try {
    const { county, months = 6 } = req.query;
    const since = new Date();
    since.setMonth(since.getMonth() - parseInt(months));

    const match = { transactionType: "transfer", status: "confirmed",
      timestamp: { $gte: since }, ...(county ? { county } : {}) };

    const trends = await Transaction.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
          avgPrice: { $avg: "$priceKES" }, sales: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, trends });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

import React, { useState } from 'react';
import {
  Package,
  Search,
  Plus,
  Filter,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Truck,
  RotateCcw
} from 'lucide-react';
import { useERP } from '../../context/ERPContext';
import { Badge } from '../common/Badge';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { NewItemModal } from './NewItemModal';
import { InventoryItem } from '../../types/erp';

export const InventoryView: React.FC = () => {
  const {
    inventory,
    lowStockItemsCount,
    formatMVR,
    setActiveTab,
    setIsCreatePOOpen
  } = useERP();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockStatusFilter, setStockStatusFilter] = useState<'All' | 'Low' | 'Healthy'>('All');
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryItem | null>(null);
  const [isNewItemOpen, setIsNewItemOpen] = useState(false);

  const totalInventoryValue = inventory.reduce(
    (sum, item) => sum + item.quantityOnHand * item.unitCost,
    0
  );

  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationInShop.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const isLow = item.quantityOnHand <= item.reorderLevel;
    const matchesStock =
      stockStatusFilter === 'All' ||
      (stockStatusFilter === 'Low' && isLow) ||
      (stockStatusFilter === 'Healthy' && !isLow);

    return matchesSearch && matchesCategory && matchesStock;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Materials & Paint Inventory
            </h1>
            <Badge variant="purple" size="sm">
              {inventory.length} Active SKUs
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automotive basecoats, 2K clearcoats, vinyl wrap rolls, PPF film, and detailing compounds
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsCreatePOOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs transition-all"
          >
            <Truck className="w-4 h-4 text-blue-600" />
            <span>New Purchase Order</span>
          </button>

          <button
            onClick={() => setIsNewItemOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total Stock Valuation
            </span>
            <div className="text-xl font-extrabold text-slate-900 mono-num mt-1">
              {formatMVR(totalInventoryValue, false)}
            </div>
            <span className="text-[10px] text-slate-400">Asset value across all bays</span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">
              Low Stock Warnings
            </span>
            <div className="text-xl font-extrabold text-rose-600 mono-num mt-1">
              {lowStockItemsCount} SKUs below threshold
            </div>
            <span className="text-[10px] text-rose-500">Requires supplier PO replenishment</span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
              Stock Turnover Health
            </span>
            <div className="text-xl font-extrabold text-emerald-600 mono-num mt-1">
              94.2% Available
            </div>
            <span className="text-[10px] text-slate-400">Zero work order delays due to paint</span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU name, code, supplier, bay rack location..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-slate-800 focus:outline-none font-medium cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Paints & Primers">Paints & Primers</option>
              <option value="Clearcoats & Hardeners">Clearcoats & Hardeners</option>
              <option value="Vinyl & PPF Film">Vinyl & PPF Film</option>
              <option value="Detailing & Ceramics">Detailing & Ceramics</option>
              <option value="Abrasives & Sandpaper">Abrasives & Sandpaper</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-slate-500">Status:</span>
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="bg-transparent text-slate-800 focus:outline-none font-medium cursor-pointer"
            >
              <option value="All">All Items</option>
              <option value="Low">Low Stock Only</option>
              <option value="Healthy">Healthy Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Item SKU & Code</th>
                <th className="py-3.5 px-4">Category & Location</th>
                <th className="py-3.5 px-4 text-center">Stock on Hand</th>
                <th className="py-3.5 px-4 text-center">Safe Min</th>
                <th className="py-3.5 px-4 text-right">Unit Cost</th>
                <th className="py-3.5 px-4 text-right">Total Valuation</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredInventory.map((item) => {
                const isLow = item.quantityOnHand <= item.reorderLevel;
                const totalItemVal = item.quantityOnHand * item.unitCost;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isLow ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    {/* Item & SKU */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] font-mono text-blue-600 font-semibold mt-0.5">{item.sku}</div>
                    </td>

                    {/* Category & Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-700">{item.category}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{item.locationInShop}</div>
                    </td>

                    {/* Quantity on Hand */}
                    <td className="py-3.5 px-4 text-center">
                      <div
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                          isLow
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                        <span>
                          {item.quantityOnHand} {item.unit}
                        </span>
                      </div>
                    </td>

                    {/* Min Level */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-mono text-slate-500 text-xs">
                        {item.reorderLevel} {item.unit}
                      </span>
                    </td>

                    {/* Unit Cost */}
                    <td className="py-3.5 px-4 text-right mono-num text-slate-700">
                      {formatMVR(item.unitCost)}
                    </td>

                    {/* Total Val */}
                    <td className="py-3.5 px-4 text-right font-bold mono-num text-slate-900">
                      {formatMVR(totalItemVal)}
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-700 text-xs">{item.supplierName}</span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedItemForAdjust(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors"
                        >
                          Adjust
                        </button>
                        {isLow && (
                          <button
                            onClick={() => {
                              setIsCreatePOOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                          >
                            Reorder
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <StockAdjustmentModal
        item={selectedItemForAdjust}
        onClose={() => setSelectedItemForAdjust(null)}
      />
      <NewItemModal
        isOpen={isNewItemOpen}
        onClose={() => setIsNewItemOpen(false)}
      />
    </div>
  );
};

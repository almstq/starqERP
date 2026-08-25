import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Modal } from '../common/Modal';
import { POLineItem } from '../../types/erp';
import { Plus, Trash2 } from 'lucide-react';

export const CreatePOModal: React.FC = () => {
  const {
    isCreatePOOpen,
    setIsCreatePOOpen,
    suppliers,
    inventory,
    createPurchaseOrder,
    formatMVR
  } = useERP();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('Deliver to Ignition Ink Garage Phase 2 Gate 1.');

  const [items, setItems] = useState<POLineItem[]>([
    {
      id: 'po-item-1',
      inventoryId: inventory[0]?.id || 'inv-1',
      itemName: inventory[0]?.name || 'Nippon Paint Auto Basecoat',
      quantity: 5,
      unit: inventory[0]?.unit || 'Liters',
      unitCost: inventory[0]?.unitCost || 1450,
      totalCost: 5 * (inventory[0]?.unitCost || 1450),
      receivedQuantity: 0
    }
  ]);

  const handleAddItem = () => {
    const defaultItem = inventory[1] || inventory[0];
    setItems([
      ...items,
      {
        id: `po-item-${Date.now()}`,
        inventoryId: defaultItem.id,
        itemName: defaultItem.name,
        quantity: 3,
        unit: defaultItem.unit,
        unitCost: defaultItem.unitCost,
        totalCost: 3 * defaultItem.unitCost,
        receivedQuantity: 0
      }
    ]);
  };

  const handleItemChange = (index: number, invId: string) => {
    const inv = inventory.find((i) => i.id === invId);
    if (!inv) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      inventoryId: inv.id,
      itemName: inv.name,
      unit: inv.unit,
      unitCost: inv.unitCost,
      totalCost: updated[index].quantity * inv.unitCost
    };
    setItems(updated);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      quantity: qty,
      totalCost: qty * updated[index].unitCost
    };
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const supp = suppliers.find((s) => s.id === supplierId);
    if (!supp) return;

    createPurchaseOrder({
      supplierId: supp.id,
      supplierName: supp.name,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate,
      items,
      subtotal: totalAmount,
      gstAmount: 0,
      totalAmount,
      status: 'Sent',
      paymentStatus: 'Unpaid',
      notes
    });

    setIsCreatePOOpen(false);
  };

  return (
    <Modal
      isOpen={isCreatePOOpen}
      onClose={() => setIsCreatePOOpen(false)}
      title="Create Purchase Order (PO)"
      subtitle="Order automotive paints, wrap rolls, and detailing compounds from suppliers"
      maxWidth="3xl"
      actions={
        <>
          <button
            type="button"
            onClick={() => setIsCreatePOOpen(false)}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
          >
            Issue Purchase Order
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier / Vendor *</label>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.islandOrCountry})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Delivery Date</label>
            <input
              type="date"
              required
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* PO Line Items */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
              Items to Order
            </span>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-12 gap-2 items-center"
              >
                <div className="col-span-12 sm:col-span-6">
                  <select
                    value={item.inventoryId}
                    onChange={(e) => handleItemChange(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    {inventory.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.sku}) — {formatMVR(inv.unitCost)}/{inv.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-4 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-mono text-center focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-4 sm:col-span-3 text-right font-bold text-slate-900 mono-num">
                  {formatMVR(item.totalCost)}
                </div>

                <div className="col-span-4 sm:col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PO Total */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
          <span className="font-bold text-slate-700">Total Purchase Order Value:</span>
          <span className="text-base font-extrabold text-blue-600 mono-num">
            {formatMVR(totalAmount)}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Instructions & Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
};

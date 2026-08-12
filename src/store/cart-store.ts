import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  barcode: string | null;
  price: number;
  costPrice: number;
  quantity: number;
  maxQty: number;
}

interface CartState {
  items: CartItem[];
  discount: number;
  paymentMethod: string;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setDiscount: (amount: number) => void;
  setPaymentMethod: (method: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,
  paymentMethod: 'CASH',

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        const newQty = Math.min(existing.quantity + (item.quantity || 1), item.maxQty);
        return { items: state.items.map((i) => (i.productId === item.productId ? { ...i, quantity: newQty } : i)) };
      }
      return { items: [...state.items, { ...item, quantity: item.quantity || 1 }] };
    });
  },

  removeItem: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) { get().removeItem(productId); return; }
    set((s) => ({
      items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(quantity, i.maxQty) } : i)),
    }));
  },

  setDiscount: (amount) => set({ discount: Math.max(0, amount) }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  clearCart: () => set({ items: [], discount: 0, paymentMethod: 'CASH' }),

  getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  getTotal: () => Math.max(0, get().getSubtotal() - get().discount),
}));

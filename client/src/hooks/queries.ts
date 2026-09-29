import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Message,
  Order,
  OrderStatus,
  PaymentMethods,
  PaymentSettings,
  Product,
  Profile,
  Project,
  Skill,
} from "../lib/types";

/* ---------------- Projects ---------------- */
export function useProjects(params?: { category?: string; admin?: boolean }) {
  const category = params?.category ?? "all";
  const admin = params?.admin ?? false;
  return useQuery({
    queryKey: ["projects", { category, admin }],
    queryFn: () =>
      api<Project[]>(
        `/projects?category=${category}`,
        admin ? { auth: true } : undefined
      ),
  });
}

export function useProject(slug: string) {
  return useQuery({
    queryKey: ["projects", slug],
    queryFn: () => api<Project>(`/projects/${slug}`),
    enabled: !!slug,
  });
}

export function useSaveProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Project> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Project>(`/projects/${id}`, { method: "PUT", body, auth: true })
        : api<Project>(`/projects`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/projects/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

/* ---------------- Products ---------------- */
export function useProducts(admin = false) {
  return useQuery({
    queryKey: ["products", { admin }],
    queryFn: () =>
      api<Product[]>(`/products`, admin ? { auth: true } : undefined),
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Product> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Product>(`/products/${id}`, { method: "PUT", body, auth: true })
        : api<Product>(`/products`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/products/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

/* ---------------- Skills ---------------- */
export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api<Skill[]>(`/skills`),
  });
}

export function useSaveSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Skill> & { id?: string }) => {
      const { id, ...body } = input;
      return id
        ? api<Skill>(`/skills/${id}`, { method: "PUT", body, auth: true })
        : api<Skill>(`/skills`, { method: "POST", body, auth: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/skills/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

/* ---------------- Profile ---------------- */
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile | null>(`/profile`),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Profile>) =>
      api<Profile>(`/profile`, { method: "PUT", body, auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/* ---------------- Messages ---------------- */
export function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: () => api<Message[]>(`/messages`, { auth: true }),
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: (body: {
      name: string;
      email: string;
      subject?: string;
      body: string;
    }) => api(`/messages`, { method: "POST", body }),
  });
}

export function useMarkMessageRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/messages/${id}/read`, { method: "PUT", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/messages/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

/* ---------------- Payments ---------------- */
export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => api<PaymentMethods>(`/payments/methods`),
    // Always get fresh availability so toggling a gateway in the admin
    // reflects immediately when a buyer opens checkout.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["payment-settings"],
    queryFn: () => api<PaymentSettings>(`/payments/settings`, { auth: true }),
  });
}

export function useSavePaymentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PaymentSettings>) =>
      api<PaymentSettings>(`/payments/settings`, {
        method: "PUT",
        body,
        auth: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-settings"] });
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: () => api<Order[]>(`/payments/orders`, { auth: true }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: OrderStatus; note?: string }) =>
      api<Order>(`/payments/orders/${id}/status`, {
        method: "PUT",
        body: { status, note },
        auth: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/payments/orders/${id}`, { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

/* ---------------- Uploads ---------------- */
export async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await api<{ url: string }>(`/uploads`, {
    method: "POST",
    body: fd,
    auth: true,
    isForm: true,
  });
  return data.url;
}

// Upload a downloadable product file (zip, pdf, etc.) â€” larger, no image filter.
export async function uploadProductFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const data = await api<{ url: string }>(`/uploads/file`, {
    method: "POST",
    body: fd,
    auth: true,
    isForm: true,
  });
  return data.url;
}
const API_BASE = '';

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('session_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok) {
      return { error: json.error || 'An error occurred', status: res.status };
    }

    return { data: json.data, status: res.status };
  } catch (err) {
    return { error: 'Network error. Please check your connection.', status: 0 };
  }
}

export function formatCurrency(amount: number): string {
  return `\u20B1${amount.toFixed(2)}`;
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}
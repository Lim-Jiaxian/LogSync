const BASE = "http://localhost:3000";

export const getToken = () => sessionStorage.getItem("token");
export const logout = () => {
  sessionStorage.removeItem("token");
  window.location.href = "/";
};

export async function api(path, method = "GET", body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.message || "Please log in again."); }
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

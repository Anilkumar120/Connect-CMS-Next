"use client";

import { useCallback, useEffect, useState } from "react";

type Settings = {
  apiKey: string;
  apiSecret: string;
  merchantId: string;
  clientId: string;
  clientSecret: string;
  bankVpa: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
};

type Gateway = {
  id: string;
  code: string;
  displayName: string;
  enabled: boolean;
  publicInstructions: string | null;
  hasEncryptedSettings: boolean;
  settings: Settings;
};

type PaymentRequest = {
  id: string;
  transactionNumber: string;
  status: string;
  customerName: string;
  accountNumber: string;
  email: string | null;
  phone: string | null;
  amount: string | number;
  gatewayCode: string;
  gatewayName: string;
  providerTransactionId: string | null;
  providerStatus: string | null;
  providerResponse: unknown;
  createdAt: string;
};

type ApiResult = {
  success?: boolean;
  message?: string;
  gateways?: Omit<Gateway, "settings">[];
  requests?: PaymentRequest[];
};

const emptySettings = (): Settings => ({
  apiKey: "",
  apiSecret: "",
  merchantId: "",
  clientId: "",
  clientSecret: "",
  bankVpa: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankIfsc: "",
});
const button: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #d5deea",
  borderRadius: 6,
  background: "#fff",
  color: "#24364b",
  fontWeight: 600,
  cursor: "pointer",
};
const primaryButton: React.CSSProperties = {
  ...button,
  border: "1px solid #0c2f55",
  background: "#0c2f55",
  color: "#fff",
};
const input: React.CSSProperties = {
  width: "100%",
  minHeight: 38,
  padding: "8px 10px",
  border: "1px solid #ccd5e0",
  borderRadius: 6,
};
const cell: React.CSSProperties = {
  padding: "11px 9px",
  borderBottom: "1px solid #edf0f4",
  textAlign: "left",
  verticalAlign: "top",
};
const emptyGateway = (code: string, displayName: string): Gateway => ({
  id: code,
  code,
  displayName,
  enabled: false,
  publicInstructions: "",
  hasEncryptedSettings: false,
  settings: emptySettings(),
});

export default function PaymentsManager() {
  const [section, setSection] = useState<"requests" | "settings">("requests");
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [transactionNumber, setTransactionNumber] = useState("");
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadGateways = useCallback(async () => {
    const response = await fetch("/api/admin/payments", { cache: "no-store" });
    const result = await response.json() as ApiResult;
    if (!response.ok || !result.success) throw new Error(result.message || "Unable to load payment settings.");
    setGateways((result.gateways ?? []).map((gateway) => ({ ...gateway, settings: emptySettings() })));
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (transactionNumber.trim()) params.set("transactionNumber", transactionNumber.trim());
      const response = await fetch(`/api/admin/payments/requests?${params}`, { cache: "no-store" });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load requests.");
      setRequests(result.requests ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load payment requests.");
    } finally {
      setLoading(false);
    }
  }, [from, to, transactionNumber]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/payments", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as ApiResult;
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load settings.");
        if (active) setGateways((result.gateways ?? []).map((gateway) => ({ ...gateway, settings: emptySettings() })));
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (section !== "requests") return;
    const timer = window.setTimeout(() => { void loadRequests(); }, 0);
    return () => window.clearTimeout(timer);
  }, [section, loadRequests]);

  function updateGateway(index: number, patch: Partial<Gateway>) {
    setGateways((current) => current.map((gateway, position) => position === index ? { ...gateway, ...patch } : gateway));
  }

  function updateSecret(index: number, key: keyof Settings, value: string) {
    setGateways((current) => current.map((gateway, position) =>
      position === index ? { ...gateway, settings: { ...gateway.settings, [key]: value } } : gateway,
    ));
  }

  async function saveGateways() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateways: gateways.map(({ code, displayName, enabled, publicInstructions, settings }) => ({
            code, displayName, enabled, publicInstructions: publicInstructions ?? "", settings,
          })),
        }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to save settings.");
      setNotice("Settings saved. Gateway integrations remain disabled; no charges can be made.");
      await loadGateways();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save settings.");
    } finally {
      setBusy(false);
    }
  }

  function addCustomGateway() {
    const name = customName.trim();
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    if (!name || !slug) {
      setError("Enter a custom gateway name.");
      return;
    }
    const code = `CUSTOM_${slug}`;
    if (gateways.some((gateway) => gateway.code === code)) {
      setError("A gateway with that name is already registered.");
      return;
    }
    setGateways((current) => [...current, emptyGateway(code, name)]);
    setCustomName("");
    setError("");
  }

  function exportCsv() {
    const headers = [
      "Request number", "Status", "Created", "Name", "Account number", "Email",
      "Phone", "Amount (unverified)", "Gateway", "Provider transaction ID",
      "Provider status", "Provider response",
    ];
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = requests.map((request) => [
      request.transactionNumber,
      request.status,
      request.createdAt,
      request.customerName,
      request.accountNumber,
      request.email,
      request.phone,
      request.amount,
      request.gatewayName,
      request.providerTransactionId,
      request.providerStatus,
      request.providerResponse ? JSON.stringify(request.providerResponse) : "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "payment-requests.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const field = (gateway: Gateway, key: keyof Settings, label: string) => (
    <label key={key} style={{ display: "grid", gap: 5, fontSize: 13 }}>
      {label}
      <input
        style={input}
        type="password"
        autoComplete="new-password"
        value={gateway.settings[key]}
        placeholder={gateway.hasEncryptedSettings ? "Saved securely — enter to replace" : "Not configured"}
        onChange={(event) => updateSecret(gateways.indexOf(gateway), key, event.target.value)}
      />
    </label>
  );

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <h1 style={{ margin: "0 12px 0 0", color: "#0c2f55" }}>Payments</h1>
        <button style={section === "requests" ? primaryButton : button} onClick={() => setSection("requests")}>Requests</button>
        <button style={section === "settings" ? primaryButton : button} onClick={() => setSection("settings")}>Gateway settings</button>
      </div>
      <div role="alert" style={{ margin: "16px 0", padding: 14, border: "1px solid #efcd76", borderRadius: 8, background: "#fff8e6", color: "#644a12" }}>
        Charging is deliberately disabled. No gateway APIs are called, no bill amount is verified, and requests cannot be marked paid until a trusted bill-lookup API and provider-specific adapters are implemented and reviewed.
      </div>
      {error && <p role="alert" style={{ color: "#a32e28" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#176536" }}>{notice}</p>}
      {section === "requests" ? (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap", margin: "16px 0" }}>
            <label style={{ display: "grid", gap: 4 }}>From date<input style={input} type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
            <label style={{ display: "grid", gap: 4 }}>To date<input style={input} type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
            <label style={{ display: "grid", gap: 4, minWidth: 230 }}>Transaction number<input style={input} value={transactionNumber} onChange={(event) => setTransactionNumber(event.target.value)} placeholder="Search request number" /></label>
            <button style={button} onClick={() => void loadRequests()}>Apply filters</button>
            <button style={button} disabled={!requests.length} onClick={exportCsv}>Export CSV ({requests.length})</button>
          </div>
          <div style={{ overflowX: "auto", border: "1px solid #e5eaf1", borderRadius: 9, background: "#fff" }}>
            <table style={{ width: "100%", minWidth: 1250, borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "#f7f9fc" }}>
                {["Request / status", "Identity / account", "Email / phone", "Amount", "Gateway", "Provider response", "Created"].map((heading) => <th key={heading} style={cell}>{heading}</th>)}
              </tr></thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td style={cell}><strong>{request.transactionNumber}</strong><div style={{ color: "#a16300", marginTop: 4 }}>{request.status} · NOT PAID</div></td>
                    <td style={cell}>{request.customerName}<div style={{ color: "#718096" }}>Account: {request.accountNumber}</div></td>
                    <td style={cell}>{request.email || "—"}<div>{request.phone || "—"}</div></td>
                    <td style={cell}>₹{Number(request.amount).toFixed(2)}<div style={{ color: "#718096" }}>Unverified</div></td>
                    <td style={cell}>{request.gatewayName}<div style={{ color: "#718096" }}>{request.gatewayCode}</div></td>
                    <td style={cell}>
                      {request.providerTransactionId || request.providerStatus || request.providerResponse ? (
                        <details>
                          <summary>View provider fields</summary>
                          <pre style={{ maxWidth: 260, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({
                            transactionId: request.providerTransactionId,
                            status: request.providerStatus,
                            response: request.providerResponse,
                          }, null, 2)}</pre>
                        </details>
                      ) : "—"}
                    </td>
                    <td style={cell}>{new Date(request.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {!loading && requests.length === 0 && <tr><td style={{ ...cell, padding: 24, color: "#718096" }} colSpan={7}>No payment requests match these filters.</td></tr>}
                {loading && <tr><td style={{ ...cell, padding: 24 }} colSpan={7}>Loading requests…</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <p style={{ color: "#556579" }}>Configure display names, enabled options, instructions, and encrypted credentials. Saving credentials does not connect or charge through a provider.</p>
          {gateways.map((gateway, index) => (
            <section key={gateway.code} style={{ margin: "18px 0", padding: 18, border: "1px solid #e1e8f0", borderRadius: 10, background: "#fff" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{gateway.displayName}</h2>
                <code style={{ color: "#718096" }}>{gateway.code}</code>
                <label style={{ display: "flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
                  <input type="checkbox" checked={gateway.enabled} onChange={(event) => updateGateway(index, { enabled: event.target.checked })} />
                  Show as request option
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
                <label style={{ display: "grid", gap: 5, fontSize: 13 }}>Display name<input style={input} maxLength={120} value={gateway.displayName} onChange={(event) => updateGateway(index, { displayName: event.target.value })} /></label>
                {gateway.code === "UPI_BANK" ? (
                  <>
                    {field(gateway, "bankVpa", "UPI VPA")}
                    {field(gateway, "bankAccountName", "Bank account name")}
                    {field(gateway, "bankAccountNumber", "Bank account number")}
                    {field(gateway, "bankIfsc", "IFSC")}
                  </>
                ) : (
                  <>
                    {field(gateway, "merchantId", "Merchant ID")}
                    {field(gateway, "apiKey", "API key")}
                    {field(gateway, "apiSecret", "API secret")}
                    {field(gateway, "clientId", "Client ID")}
                    {field(gateway, "clientSecret", "Client secret")}
                  </>
                )}
              </div>
              <label style={{ display: "grid", gap: 5, marginTop: 14, fontSize: 13 }}>
                Public instructions
                <textarea style={{ ...input, minHeight: 80, resize: "vertical" }} maxLength={4000} value={gateway.publicInstructions ?? ""} onChange={(event) => updateGateway(index, { publicInstructions: event.target.value })} />
              </label>
              <p style={{ margin: "8px 0 0", color: "#718096", fontSize: 12 }}>
                {gateway.hasEncryptedSettings ? "Encrypted settings are saved. Leave secret fields blank to keep them unchanged." : "Secrets are not set. When configured, values are encrypted with AES-GCM and never returned."}
              </p>
            </section>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "20px 0" }}>
            <input style={{ ...input, maxWidth: 320 }} value={customName} maxLength={120} onChange={(event) => setCustomName(event.target.value)} placeholder="Custom gateway display name" />
            <button style={button} onClick={addCustomGateway}>Add custom gateway</button>
            <button style={primaryButton} disabled={busy || loading} onClick={() => void saveGateways()}>{busy ? "Saving…" : "Save gateway settings"}</button>
          </div>
          <p style={{ color: "#718096", fontSize: 12 }}>Unknown and custom gateway records are configuration only; they cannot charge or confirm a payment.</p>
        </>
      )}
    </div>
  );
}

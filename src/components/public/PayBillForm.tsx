"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./PayBillForm.module.css";

type Gateway = {
  code: string;
  displayName: string;
  publicInstructions: string | null;
  publicDetails?: {
    bankVpa?: string;
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankIfsc?: string;
  };
};

type ApiResult = {
  success?: boolean;
  message?: string;
  gateways?: Gateway[];
  request?: { transactionNumber: string };
};

export default function PayBillForm() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gatewayCode, setGatewayCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedGateway = useMemo(
    () => gateways.find((gateway) => gateway.code === gatewayCode),
    [gatewayCode, gateways],
  );

  useEffect(() => {
    let active = true;
    fetch("/api/public/payments/gateways", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as ApiResult;
        if (!response.ok || !result.success) throw new Error(result.message || "Unable to load payment options.");
        if (active) {
          setGateways(result.gateways ?? []);
          setGatewayCode(result.gateways?.[0]?.code ?? "");
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load payment options.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/public/payments/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          accountNumber,
          email,
          phone,
          amount,
          gatewayCode,
          privacyConsent,
        }),
      });
      const result = await response.json() as ApiResult;
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to record request.");
      setNotice(`Request ${result.request?.transactionNumber ?? ""} recorded as pending bill lookup. No payment was made, verified, or marked paid.`);
      setCustomerName("");
      setAccountNumber("");
      setEmail("");
      setPhone("");
      setAmount("");
      setPrivacyConsent(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Customer services</p>
        <h1>Pay Bill</h1>
        <div className={styles.warning} role="note">
          <strong>Payments are not enabled.</strong> Submitting this form only records an
          unverified request. We do not check your bill or charge, transfer, or confirm
          money. The amount you enter is not a verified bill amount and your request is
          <strong> not proof of payment.</strong>
        </div>
        {notice && <div className={styles.success} role="status">{notice}</div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
        {loading ? (
          <p>Loading available request options…</p>
        ) : gateways.length === 0 ? (
          <p className={styles.empty}>No request options are currently available.</p>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <label>
              Name
              <input autoComplete="name" maxLength={160} required value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              Connect / Account Number
              <input maxLength={80} required value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
            </label>
            <div className={styles.twoColumns}>
              <label>
                Registered Email
                <input type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label>
                Registered Phone
                <input type="tel" autoComplete="tel" maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} />
              </label>
            </div>
            <p className={styles.help}>Enter at least one registered contact method: email or phone.</p>
            <div className={styles.twoColumns}>
              <label>
                Amount (₹) — unverified
                <input type="number" min="1" max="10000000" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
              <label>
                Select Gateway / Request Method
                <select required value={gatewayCode} onChange={(event) => setGatewayCode(event.target.value)}>
                  {gateways.map((gateway) => <option key={gateway.code} value={gateway.code}>{gateway.displayName}</option>)}
                </select>
              </label>
            </div>
            {selectedGateway?.publicInstructions && (
              <div className={styles.instructions}>
                <strong>{selectedGateway.displayName} information</strong>
                <p>{selectedGateway.publicInstructions}</p>
              </div>
            )}
            {selectedGateway?.publicDetails && Object.values(selectedGateway.publicDetails).some(Boolean) && (
              <dl className={styles.details}>
                {selectedGateway.publicDetails.bankVpa && <><dt>UPI ID</dt><dd>{selectedGateway.publicDetails.bankVpa}</dd></>}
                {selectedGateway.publicDetails.bankAccountName && <><dt>Account name</dt><dd>{selectedGateway.publicDetails.bankAccountName}</dd></>}
                {selectedGateway.publicDetails.bankAccountNumber && <><dt>Account number</dt><dd>{selectedGateway.publicDetails.bankAccountNumber}</dd></>}
                {selectedGateway.publicDetails.bankIfsc && <><dt>IFSC</dt><dd>{selectedGateway.publicDetails.bankIfsc}</dd></>}
              </dl>
            )}
            <label className={styles.consent}>
              <input type="checkbox" required checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} />
              <span>I consent to the use of these details to record and follow up on this unverified payment request. I understand this does not make or confirm a payment.</span>
            </label>
            <button type="submit" disabled={busy || !gatewayCode}>
              {busy ? "Recording request…" : "Record unverified request"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

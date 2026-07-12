import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ChevronDown, Loader2, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatMobile } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppTile } from "@/components/WhatsAppTile";
import {
  COUNTRIES,
  Country,
  detectCountry,
  getCountryByCode,
  formatLocalNumber,
  buildFullNumber,
} from "@/lib/countries";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import meraRashanLogo from "@/assets/mera-rashan-logo.webp";

function getMobileSchema(country: Country) {
  return z
    .string()
    .regex(/^\d+$/, "Enter Mobile Number!")
    .length(country.maxLength, `Enter a valid ${country.name} number (${country.maxLength} digits)`);
}

type Step = "mobile" | "otp" | "account_not_found";
const MOBILE_STORAGE_KEY = "mr_login_mobile";

export default function Login({ onLogin }: { onLogin: (m: string) => void }) {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);


  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Detect the user's country from device timezone/language on mount.
  useEffect(() => {
    const detected = detectCountry();
    const country = getCountryByCode(detected) ?? COUNTRIES[0];
    setSelectedCountry(country);
  }, []);

  // If we were just kicked back here because a previous session resolved to
  // an account-not-found state (e.g. customers fetch returned 403/404), show
  // the dedicated UI immediately instead of the mobile-entry form.
  useEffect(() => {
    try {
      const flagged = localStorage.getItem("mr_account_not_found");
      if (flagged) {
        const cleaned = formatMobile(flagged);
        const country = COUNTRIES.find((c) => cleaned.startsWith(c.dialCode)) ?? COUNTRIES[0];
        const local = cleaned.slice(country.dialCode.length);
        setSelectedCountry(country);
        setLocalNumber(formatLocalNumber(local, country.maxLength));
        setMobile(cleaned);
        setStep("account_not_found");
        localStorage.removeItem("mr_account_not_found");
      }
    } catch { /* ignore */ }
  }, []);

  // Restore the previously entered mobile number (unless we're showing the
  // account-not-found state, which takes precedence).
  useEffect(() => {
    try {
      const flagged = localStorage.getItem("mr_account_not_found");
      if (flagged) return;
      const saved = localStorage.getItem(MOBILE_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { countryCode?: string; localNumber?: string };
      if (!parsed.countryCode || !parsed.localNumber) return;
      const country = getCountryByCode(parsed.countryCode) ?? COUNTRIES[0];
      setSelectedCountry(country);
      setLocalNumber(formatLocalNumber(parsed.localNumber, country.maxLength));
    } catch { /* ignore */ }
  }, []);

  // Persist the mobile number as the user types so it survives page reloads.
  useEffect(() => {
    try {
      const digits = localNumber.replace(/\D/g, "");
      if (!digits) {
        localStorage.removeItem(MOBILE_STORAGE_KEY);
        return;
      }
      localStorage.setItem(
        MOBILE_STORAGE_KEY,
        JSON.stringify({ countryCode: selectedCountry.code, localNumber: digits }),
      );
    } catch { /* ignore */ }
  }, [localNumber, selectedCountry]);






  const resetToMobile = () => {
    setStep("mobile");
    setCode("");
    setError(null);
  };

  const sendOtp = async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mobile: m }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send code");
      setStep("otp");
      setResendIn(120);

      toast({ title: "Code sent", description: `OTP sent to ${m}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const bypassLogin = async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mobile: m, code: "000000" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      if (!data?.token_hash) throw new Error("Missing session token");
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (vErr) throw new Error(vErr.message);
      onLogin(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const checkBypass = async (m: string): Promise<boolean> => {
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-otp-bypass`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mobile: m }),
      });
      const data = await res.json().catch(() => ({}));
      return !!data?.bypass;
    } catch {
      return false;
    }
  };

  // Verify the mobile maps to an existing customer before sending an OTP.
  // Returns true when an account exists, false when not, null on transport error
  // (we let those fall through to the normal OTP flow rather than block login).
  const checkAccountExists = async (m: string): Promise<boolean | null> => {
    try {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/merarashan-proxy`);
      url.searchParams.set("resource", "customers");
      url.searchParams.set("mobile", m);
      // Bust both the browser HTTP cache and the service-worker NetworkFirst
      // layer so a previously successful (pre-deletion) response can't mask
      // a fresh 404 for a deleted account.
      url.searchParams.set("_b", String(Date.now()));
      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "";
        if (res.status === 403 || res.status === 404 || /account does not exist|not found/i.test(msg)) {
          return false;
        }
        return null;
      }
      return Array.isArray(data) && data.length > 0;
    } catch {
      return null;
    }
  };

  const submitMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    const localDigits = localNumber.replace(/\D/g, "");
    const parsed = getMobileSchema(selectedCountry).safeParse(localDigits);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    const cleaned = buildFullNumber(selectedCountry.dialCode, localNumber);
    setMobile(cleaned);
    setLoading(true);
    // Always check the account exists first — even bypass numbers must map
    // to a real customer or the post-login screen will 403 on /customers.
    const exists = await checkAccountExists(cleaned);
    if (exists === false) {
      setLoading(false);
      setStep("account_not_found");
      return;
    }
    const isBypass = await checkBypass(cleaned);
    setLoading(false);
    if (isBypass) {
      bypassLogin(cleaned);
      return;
    }
    sendOtp(cleaned);
  };

  const verifyOtpCode = async (otpCode: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ mobile, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Verification failed");
      if (!data?.token_hash) throw new Error("Missing session token");
      const { error: vErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });
      if (vErr) throw new Error(vErr.message);
      onLogin(mobile);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Verification failed";
      setError(/incorrect code/i.test(msg) ? "Wrong code. Please try again." : msg);

    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code");
      return;
    }
    await verifyOtpCode(code);
  };

  const otpInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      const next = code.split("");
      next[index] = "";
      const joined = next.join("").slice(0, 6);
      setCode(joined);
      setError(null);
      return;
    }
    const current = code.split("");
    let i = index;
    for (const ch of digits) {
      if (i >= 6) break;
      current[i] = ch;
      i++;
    }
    const joined = current.join("").slice(0, 6);
    setCode(joined);
    setError(null);
    const focusIndex = Math.min(i, 5);
    otpInputsRef.current[focusIndex]?.focus();
    otpInputsRef.current[focusIndex]?.select();
    if (joined.length === 6 && !loading) {
      verifyOtpCode(joined);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (code[index]) {
        const next = code.split("");
        next[index] = "";
        setCode(next.join(""));
        setError(null);
      } else if (index > 0) {
        otpInputsRef.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center px-2">
      <Card className="w-full max-w-sm px-3 py-8 shadow-[var(--shadow-card)] border-0 bg-card/80 backdrop-blur">
        <img src={meraRashanLogo} alt="Mera Rashan Card" className="w-32 h-32 mx-auto mb-4 object-contain" />
        <h1 className="sr-only">Mera Rashan</h1>
        <div className="text-sm text-muted-foreground text-center mt-1 mb-6 space-y-1">
          {step === "mobile" && (
            <>
              <h2 className="text-xl font-semibold text-foreground">Log in to your account</h2>
              <p>Enter the mobile number associated with your Mera Rashan account.</p>
            </>
          )}
          {step === "otp" && (
            <>
              <h2 className="text-xl font-semibold text-foreground">Enter 6-digit the code</h2>
              <p>
                Code sent via SMS and WhatsApp to{" "}
                <span className="font-semibold text-foreground">+{mobile}</span>, if an account
                exists with this number.
              </p>
            </>
          )}

          {step === "account_not_found" && <p>We couldn't find an account</p>}
        </div>
        {step === "mobile" && (
          <form onSubmit={submitMobile} className="space-y-3">
            <div className="flex flex-row items-stretch rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Sheet open={countryOpen} onOpenChange={setCountryOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="h-12 w-auto shrink-0 px-3 text-base font-normal border-0 border-r border-foreground/40 rounded-none rounded-l-md bg-transparent hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <span className="flex items-center overflow-hidden">
                    <span className="mr-1.5">{selectedCountry.flag}</span>
                    <span className="text-muted-foreground">+{selectedCountry.dialCode}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                </Button>
              </SheetTrigger>
                <SheetContent side="bottom" className="p-0 rounded-t-xl max-h-[85vh] flex flex-col" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <SheetHeader className="px-4 pt-4 pb-2 text-left">
                    <SheetTitle>Choose country</SheetTitle>
                  </SheetHeader>
                  <Input
                    type="text"
                    placeholder="Search country or code"
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    className="mx-4 mb-2 w-auto"
                  />
                  <div className="flex-1 overflow-y-auto p-2">
                    {filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        className="w-full flex items-center rounded-sm px-3 py-3 text-sm text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                        onClick={() => {
                          setSelectedCountry(country);
                          setLocalNumber((prev) => formatLocalNumber(prev, country.maxLength));
                          setCountrySearch("");
                          setCountryOpen(false);
                          setError(null);
                        }}
                      >
                        <span className="mr-2">{country.flag}</span>
                        <span className="text-muted-foreground">+{country.dialCode}</span>
                        <span className="ml-2">{country.name}</span>
                      </button>
                    ))}
                    {filteredCountries.length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground text-center">
                        No country found
                      </p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={selectedCountry.maxLength}
                placeholder={selectedCountry.placeholder}
                value={localNumber}
                onChange={(e) => {
                  setLocalNumber(formatLocalNumber(e.target.value, selectedCountry.maxLength));
                  setError(null);
                }}
                className="h-12 text-base text-left flex-1 border-0 rounded-none rounded-r-md bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={loading}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold text-primary-foreground border-0 hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log in"}
            </Button>
            <p className="text-sm text-center text-muted-foreground pt-1">
              New to Mera Rashan?{" "}
              <a
                href="https://wa.me/923030812222"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Create account
              </a>
            </p>
          </form>
        )}
        {step === "otp" && (
          <form onSubmit={submitOtp} className="space-y-3">
            <div className="flex justify-between gap-2" onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/\d/.test(text)) {
                e.preventDefault();
                handleOtpChange(0, text);
              }
            }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Input
                  key={i}
                  ref={(el) => { otpInputsRef.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={code[i] ?? ""}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-12 w-full px-0 text-center text-lg font-semibold"
                  disabled={loading}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={resetToMobile}
                disabled={loading}
              >
                Change number
              </button>
              {loading && resendIn === 0 ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Resending…
                </span>
              ) : resendIn > 0 ? (
                <span className="text-muted-foreground">
                  Resend code in <span className="font-semibold text-foreground">{resendIn} seconds</span>
                </span>
              ) : (
                <button
                  type="button"
                  className="text-primary font-medium hover:underline disabled:opacity-50"
                  onClick={() => {
                    setResendIn(120);
                    sendOtp(mobile);
                  }}
                  disabled={loading}
                >
                  Resend code
                </button>
              )}

            </div>
          </form>
        )}

        {step === "account_not_found" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <UserX className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No account found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                We couldn't find a Mera Rashan account linked to{" "}
                <span className="font-mono text-foreground">+{mobile}</span>. Please check the
                number or contact support for help.
              </p>
            </div>
            <Button
              type="button"
              className="w-full h-12 text-base font-semibold text-primary-foreground border-0 hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}
              onClick={resetToMobile}
            >
              Try another number
            </Button>
            <WhatsAppTile
              href="https://wa.me/923030812222"
              number="923030812222"
              title="@mera.rashan"
              subtitle="Chat on WhatsApp"
              showCopy={false}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

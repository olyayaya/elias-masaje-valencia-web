import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/context";
import { WHATSAPP_PHONE } from "@/config/contact";
import { CheckCircle2, MessageCircle, Loader2, Copy, Check } from "lucide-react";

type Locale = "es" | "en" | "ru";

const T: Record<Locale, {
  title: string;
  subtitle: string;
  step1: string;
  step2: string;
  step3: string;
  newPassword: string;
  confirmPassword: string;
  placeholder: string;
  save: string;
  saving: string;
  saved: string;
  whatsappBtn: string;
  whatsappHint: string;
  copyBtn: string;
  copiedBtn: string;
  later: string;
  errMatch: string;
  errLength: string;
  errGeneric: string;
}> = {
  es: {
    title: "¡Bienvenido, Elias! 👋",
    subtitle: "Tu cuenta de administrador está lista. Vamos a asegurarla en menos de un minuto.",
    step1: "1. Cambia tu contraseña temporal por una propia (mínimo 8 caracteres).",
    step2: "2. Guarda estos pasos en tu WhatsApp para futuras consultas.",
    step3: "3. Explora el panel: servicios, blog, FAQ, promociones, integraciones.",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirma la contraseña",
    placeholder: "Mínimo 8 caracteres",
    save: "Cambiar contraseña",
    saving: "Guardando…",
    saved: "Contraseña actualizada",
    whatsappBtn: "Enviar pasos a mi WhatsApp",
    whatsappHint: "Abre WhatsApp con un resumen para guardarlo.",
    copyBtn: "Copiar texto",
    copiedBtn: "Copiado",
    later: "Recordármelo más tarde",
    errMatch: "Las contraseñas no coinciden.",
    errLength: "La contraseña debe tener al menos 8 caracteres.",
    errGeneric: "No se pudo actualizar la contraseña. Inténtalo de nuevo.",
  },
  en: {
    title: "Welcome, Elias! 👋",
    subtitle: "Your admin account is ready. Let's secure it in under a minute.",
    step1: "1. Replace the temporary password with your own (minimum 8 characters).",
    step2: "2. Save these steps to your WhatsApp for future reference.",
    step3: "3. Explore the dashboard: services, blog, FAQ, promotions, integrations.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    placeholder: "At least 8 characters",
    save: "Change password",
    saving: "Saving…",
    saved: "Password updated",
    whatsappBtn: "Send steps to my WhatsApp",
    whatsappHint: "Opens WhatsApp with a summary you can keep for later.",
    copyBtn: "Copy text",
    copiedBtn: "Copied",
    later: "Remind me later",
    errMatch: "Passwords don't match.",
    errLength: "Password must be at least 8 characters.",
    errGeneric: "Could not update password. Please try again.",
  },
  ru: {
    title: "Добро пожаловать, Elias! 👋",
    subtitle: "Аккаунт администратора готов. Защитим его меньше чем за минуту.",
    step1: "1. Замените временный пароль на свой (минимум 8 символов).",
    step2: "2. Сохраните эти шаги в WhatsApp на будущее.",
    step3: "3. Изучите панель: услуги, блог, FAQ, акции, интеграции.",
    newPassword: "Новый пароль",
    confirmPassword: "Подтвердите пароль",
    placeholder: "Минимум 8 символов",
    save: "Сменить пароль",
    saving: "Сохраняем…",
    saved: "Пароль обновлён",
    whatsappBtn: "Отправить шаги в мой WhatsApp",
    whatsappHint: "Откроет WhatsApp со сводкой, которую можно сохранить.",
    copyBtn: "Копировать текст",
    copiedBtn: "Скопировано",
    later: "Напомнить позже",
    errMatch: "Пароли не совпадают.",
    errLength: "Пароль должен содержать минимум 8 символов.",
    errGeneric: "Не удалось обновить пароль. Попробуйте ещё раз.",
  },
};

const buildWhatsAppText = (locale: Locale): string => {
  const dashboard = `${window.location.origin}/dashboard`;
  const lines: Record<Locale, string[]> = {
    es: [
      "🌿 Elias Masaje — Acceso de administrador",
      "",
      `Panel: ${dashboard}`,
      "Email: elias.massagess@gmail.com",
      "",
      "Próximos pasos:",
      "1. Inicia sesión y cambia tu contraseña temporal.",
      "2. Si olvidas la contraseña, usa 'Recuperar contraseña' en la pantalla de acceso.",
      "3. Desde el panel puedes editar servicios, blog, promociones y más.",
    ],
    en: [
      "🌿 Elias Masaje — Admin access",
      "",
      `Dashboard: ${dashboard}`,
      "Email: elias.massagess@gmail.com",
      "",
      "Next steps:",
      "1. Sign in and replace your temporary password.",
      "2. If you forget it, use 'Forgot password' on the sign-in page.",
      "3. The dashboard manages services, blog, promotions, and more.",
    ],
    ru: [
      "🌿 Elias Masaje — Доступ администратора",
      "",
      `Панель: ${dashboard}`,
      "Email: elias.massagess@gmail.com",
      "",
      "Следующие шаги:",
      "1. Войдите и смените временный пароль.",
      "2. Забыли пароль — нажмите 'Восстановить' на странице входа.",
      "3. В панели управляются услуги, блог, акции и т.д.",
    ],
  };
  return lines[locale].join("\n");
};

const buildWhatsAppMessage = (locale: Locale) => {
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(buildWhatsAppText(locale))}`;
};

const OnboardingDialog = () => {
  const { locale } = useI18n();
  const t = T[(locale as Locale) ?? "es"];

  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Decide whether to show the dialog based on user_metadata.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data?.user?.user_metadata?.needs_onboarding === true) {
        setOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setError(null);
    if (pwd.length < 8) {
      setError(t.errLength);
      return;
    }
    if (pwd !== confirm) {
      setError(t.errMatch);
      return;
    }
    setSaving(true);
    const { error: updateErr } = await supabase.auth.updateUser({
      password: pwd,
      data: { needs_onboarding: false },
    });
    setSaving(false);
    if (updateErr) {
      setError(t.errGeneric);
      return;
    }
    setDone(true);
    setTimeout(() => setOpen(false), 1500);
  };

  const dismissForNow = async () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) setOpen(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">{t.title}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        <ul className="text-sm text-muted-foreground space-y-1.5 mt-1">
          <li>{t.step1}</li>
          <li>{t.step2}</li>
          <li>{t.step3}</li>
        </ul>

        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="onb-pwd">{t.newPassword}</Label>
            <Input
              id="onb-pwd"
              type="password"
              autoComplete="new-password"
              placeholder={t.placeholder}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              disabled={saving || done}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onb-pwd2">{t.confirmPassword}</Label>
            <Input
              id="onb-pwd2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={saving || done}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleSave}
            disabled={saving || done}
            className="w-full"
          >
            {done ? (
              <><CheckCircle2 size={16} className="mr-2" />{t.saved}</>
            ) : saving ? (
              <><Loader2 size={16} className="mr-2 animate-spin" />{t.saving}</>
            ) : (
              t.save
            )}
          </Button>
        </div>

        <div className="border-t border-border pt-3 mt-1 space-y-2">
          <a
            href={buildWhatsAppMessage((locale as Locale) ?? "es")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm rounded-md bg-[#25D366] text-white hover:opacity-90 transition-opacity"
          >
            <MessageCircle size={16} />
            {t.whatsappBtn}
          </a>
          <p className="text-xs text-muted-foreground text-center">{t.whatsappHint}</p>

          {!done && (
            <button
              onClick={dismissForNow}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
            >
              {t.later}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingDialog;

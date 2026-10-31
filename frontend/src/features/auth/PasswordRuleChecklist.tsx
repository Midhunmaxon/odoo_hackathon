import React from 'react';
import { Check, X } from 'lucide-react';

export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

export function evaluatePasswordRules(password: string): PasswordRule[] {
  return [
    {
      id: 'length',
      label: 'More than 8 characters (at least 9)',
      met: password.length > 8,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*)',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export const PasswordRuleChecklist: React.FC<{ password: string; showAlways?: boolean }> = ({
  password,
  showAlways = false,
}) => {
  if (!password && !showAlways) {
    return null;
  }

  const rules = evaluatePasswordRules(password);
  const allMet = rules.every((r) => r.met);

  return (
    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1.5 transition-all">
      <div className="flex items-center justify-between font-semibold text-slate-700 mb-1">
        <span>Password Requirements:</span>
        <span className={allMet ? 'text-emerald-600' : 'text-slate-400'}>
          {rules.filter((r) => r.met).length}/{rules.length} met
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`flex items-center space-x-1.5 transition-colors ${
              rule.met ? 'text-emerald-700 font-medium' : 'text-slate-400'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                rule.met ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
              }`}
            >
              {rule.met ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <span>{rule.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordRuleChecklist;

"use client";

/**
 * 신규 위촉 — 단계형 대화상자
 * ① 인물 검색 → ② (없으면) 인물 등록 → ③ 소속직위 선택·추가 → ④ 위촉 정보
 * 모든 저장은 서버 동작이 권한과 규칙을 다시 확인한다.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WarningBox, type FormActionResult } from "@/components/form/form-dialog";
import { FormField, SelectField } from "@/components/form/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcExpireDue, formatDate, parseDate } from "@/lib/rules/term";
import { createAppoint } from "./appoint-actions";
import {
  addPosition,
  createPerson,
  findSamePersons,
  getPerson,
  searchPersons,
  type PersonHit,
} from "./person-actions";
import { PersonFields } from "./person-fields";
import type { RosterOptions } from "./roster";

type Step = "search" | "register" | "position" | "appoint";

/** 서버 동작 결과의 오류·경고를 보여 주는 칸 */
function ResultMessage({ result }: { result: FormActionResult<unknown> | null }) {
  if (!result || result.ok) return null;
  if (result.warnings?.length) return <WarningBox message={result.message} warnings={result.warnings} />;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>
        {result.message}
        {result.fieldErrors && (
          <ul className="mt-1 list-disc pl-5">
            {Object.values(result.fieldErrors).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function NewAppointDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: RosterOptions;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {/* 닫으면 내용이 빠지므로 다시 열 때 처음 단계부터 시작한다 */}
        <Wizard options={options} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Wizard({ options, onDone }: { options: RosterOptions; onDone: () => void }) {
  const [step, setStep] = useState<Step>("search");
  const [person, setPerson] = useState<PersonHit | null>(null);
  const [posId, setPosId] = useState<string>("");

  const choosePerson = (p: PersonHit) => {
    setPerson(p);
    setPosId(p.positions[0]?.posId ?? "");
    setStep("position");
  };

  const titles: Record<Step, string> = {
    search: "신규 위촉 ① 인물 찾기",
    register: "신규 위촉 ② 새 인물 등록",
    position: "신규 위촉 ③ 소속직위 고르기",
    appoint: "신규 위촉 ④ 위촉 정보",
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{titles[step]}</DialogTitle>
        <DialogDescription>
          {person ? `${person.name} (${person.genderLabel}, ${person.birthDate})` : "인물은 모든 위원회가 함께 쓰는 정보입니다. 먼저 검색하세요."}
        </DialogDescription>
      </DialogHeader>
      {step === "search" && <SearchStep onPick={choosePerson} onNew={() => setStep("register")} />}
      {step === "register" && (
        <RegisterStep onCreated={choosePerson} onPickExisting={choosePerson} onBack={() => setStep("search")} />
      )}
      {step === "position" && person && (
        <PositionStep
          person={person}
          posId={posId}
          onChange={setPosId}
          onPersonUpdated={setPerson}
          onBack={() => setStep("search")}
          onNext={() => setStep("appoint")}
        />
      )}
      {step === "appoint" && person && (
        <AppointStep
          options={options}
          person={person}
          posId={posId}
          onBack={() => setStep("position")}
          onDone={onDone}
        />
      )}
    </>
  );
}

function SearchStep({ onPick, onNew }: { onPick: (p: PersonHit) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PersonHit[] | null>(null);
  const [pending, startTransition] = useTransition();
  const search = () => startTransition(async () => setHits(await searchPersons(q)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="성명 입력"
          aria-label="성명"
          autoFocus
        />
        <Button type="button" onClick={search} disabled={pending || !q.trim()}>
          {pending ? "검색 중…" : "검색"}
        </Button>
      </div>
      {hits && (
        <div className="max-h-72 overflow-y-auto rounded-md border">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">검색 결과가 없습니다. 새 인물로 등록하세요.</p>
          ) : (
            <ul className="divide-y">
              {hits.map((h) => (
                <li key={h.personId} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {h.name} <span className="text-muted-foreground">({h.genderLabel}, {h.birthDate})</span>
                    </div>
                    <div className="text-muted-foreground">
                      {h.positions.map((p) => p.label).join(" · ") || "등록된 소속직위 없음"}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onPick(h)}>
                    선택
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onNew}>
          찾는 인물이 없습니다 — 새로 등록
        </Button>
      </DialogFooter>
    </div>
  );
}

function RegisterStep({
  onCreated,
  onPickExisting,
  onBack,
}: {
  onCreated: (p: PersonHit) => void;
  onPickExisting: (p: PersonHit) => void;
  onBack: () => void;
}) {
  const [result, setResult] = useState<FormActionResult<unknown> | null>(null);
  const [same, setSame] = useState<PersonHit[] | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (fd: FormData, confirmed: boolean) =>
    startTransition(async () => {
      // 같은 성명·생년월일이 있으면 먼저 기존 인물 사용을 권한다
      if (!confirmed) {
        const found = await findSamePersons(String(fd.get("person_name") ?? ""), String(fd.get("birth_date") ?? ""));
        if (found.length) {
          setSame(found);
          return;
        }
      }
      if (confirmed) fd.set("confirm_duplicate", "Y");
      const r = await createPerson(null, fd);
      setResult(r);
      if (r.ok && r.data) {
        toast.success(r.message);
        onCreated(r.data.person);
      }
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget), same !== null);
      }}
    >
      <ResultMessage result={result} />
      {same && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">같은 성명·생년월일의 인물이 이미 있습니다. 기존 인물을 사용하시겠습니까?</p>
          <ul className="mt-2 flex flex-col gap-2">
            {same.map((s) => (
              <li key={s.personId} className="flex items-center justify-between gap-2">
                <span>
                  {s.name} ({s.genderLabel}, {s.birthDate}) — {s.positions.map((p) => p.label).join(" · ") || "소속직위 없음"}
                </span>
                <Button type="button" size="sm" onClick={() => onPickExisting(s)}>
                  이 인물 사용
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2">동명이인이 확실하면 아래 &quot;새로 등록&quot;을 누르세요.</p>
        </div>
      )}
      <PersonFields />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          이전
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "처리 중…" : same ? "동명이인입니다 — 새로 등록" : "등록하고 다음"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PositionStep({
  person,
  posId,
  onChange,
  onPersonUpdated,
  onBack,
  onNext,
}: {
  person: PersonHit;
  posId: string;
  onChange: (id: string) => void;
  onPersonUpdated: (p: PersonHit) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        이 위원회 명부에 표시할 소속직위를 고릅니다. 위원회마다 다른 소속직위로 표시할 수 있습니다.
      </p>
      <PositionPicker person={person} value={posId} onChange={onChange} onPersonUpdated={onPersonUpdated} />
      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          이전
        </Button>
        <Button onClick={onNext} disabled={!posId}>
          다음
        </Button>
      </DialogFooter>
    </div>
  );
}

/** 인물의 소속직위 고르기 + 새 소속직위 추가 (신규 위촉·소속직위 변경 공용) */
export function PositionPicker({
  person,
  value,
  onChange,
  onPersonUpdated,
  exclude,
}: {
  person: PersonHit;
  value: string;
  onChange: (posId: string) => void;
  onPersonUpdated: (p: PersonHit) => void;
  /** 고를 수 없는 소속직위 (지금 쓰는 것) */
  exclude?: string;
}) {
  const [org, setOrg] = useState("");
  const [pos, setPos] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const choices = person.positions.filter((p) => p.posId !== exclude);

  const add = () =>
    startTransition(async () => {
      const fd = new FormData();
      fd.set("person_id", person.personId);
      fd.set("org_name", org);
      fd.set("pos_name", pos);
      const r = await addPosition(null, fd);
      if (!r.ok) {
        setError(Object.values(r.fieldErrors ?? {})[0] ?? r.message);
        return;
      }
      setError(null);
      setOrg("");
      setPos("");
      const refreshed = await getPerson(person.personId);
      if (refreshed) onPersonUpdated(refreshed);
      if (r.data) onChange(r.data.posId);
      toast.success(r.message);
    });

  return (
    <div className="flex flex-col gap-3">
      {choices.length > 0 ? (
        <fieldset className="flex flex-col gap-2" aria-label="소속직위">
          {choices.map((p) => (
            <label key={p.posId} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input
                type="radio"
                name="pos_choice"
                value={p.posId}
                checked={value === p.posId}
                onChange={() => onChange(p.posId)}
              />
              {p.label}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">고를 수 있는 소속직위가 없습니다. 아래에서 추가하세요.</p>
      )}
      <div className="rounded-md border border-dashed p-3">
        <Label className="mb-2 block">새 소속직위 추가</Label>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="소속기관명" aria-label="소속기관명" />
          <Input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="직위명" aria-label="직위명" />
          <Button type="button" variant="outline" onClick={add} disabled={pending || !org.trim() || !pos.trim()}>
            추가
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

function AppointStep({
  options,
  person,
  posId,
  onBack,
  onDone,
}: {
  options: RosterOptions;
  person: PersonHit;
  posId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const [result, setResult] = useState<FormActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("APPOINTED");
  const [kind, setKind] = useState("NEW");
  const [start, setStart] = useState(options.today);
  const [expire, setExpire] = useState("");

  let autoExpire = "";
  try {
    autoExpire = formatDate(calcExpireDue(parseDate(start), options.termYr));
  } catch {
    autoExpire = "";
  }
  const posLabel = person.positions.find((p) => p.posId === posId)?.label ?? "";
  const warnings = result && !result.ok ? (result.warnings ?? []) : [];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await createAppoint(null, fd);
          setResult(r);
          if (r.ok) {
            toast.success(r.message);
            onDone();
          }
        });
      }}
    >
      <ResultMessage result={result} />
      <input type="hidden" name="comm_id" value={options.commId} />
      <input type="hidden" name="pos_id" value={posId} />
      {warnings.length > 0 && <input type="hidden" name="confirm_warnings" value="Y" />}
      <p className="text-sm">
        소속직위: <b>{posLabel}</b>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="appos_id" label="위원회 내 직위">
          <SelectField name="appos_id" options={options.apposOptions} placeholder="직위 선택" />
        </FormField>
        <FormField name="appoint_type" label="위촉유형">
          <SelectField
            name="appoint_type"
            value={type}
            onValueChange={setType}
            options={[
              { value: "APPOINTED", label: "위촉직" },
              { value: "EX_OFFICIO", label: "당연직" },
            ]}
          />
        </FormField>
        <FormField name="appoint_kind" label="위촉 구분">
          <SelectField
            name="appoint_kind"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "NEW", label: "신규" },
              { value: "BY_ELECT", label: "보궐" },
            ]}
          />
        </FormField>
        <FormField name="appoint_start" label="위촉일">
          <Input
            id="appoint_start"
            name="appoint_start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </FormField>
        {type === "APPOINTED" ? (
          <div className="sm:col-span-2">
            <FormField
              name="expire_due"
              label="만료 예정일"
              hint={`비워 두면 위촉일 + ${options.termYr}년 − 1일 = ${autoExpire || "-"}. ${kind === "BY_ELECT" ? "보궐이면 전임자의 남은 임기 만료일을 넣으세요." : ""}`}
            >
              <Input
                id="expire_due"
                name="expire_due"
                type="date"
                value={expire}
                onChange={(e) => setExpire(e.target.value)}
              />
            </FormField>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">당연직은 만료 예정일이 없습니다.</p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onBack} disabled={pending}>
          이전
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중…" : warnings.length ? "경고를 확인했습니다. 위촉" : "위촉"}
        </Button>
      </DialogFooter>
    </form>
  );
}

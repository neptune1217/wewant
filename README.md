# wewant — 춘천시 위원회·위원 통합관리 시스템

춘천시 각 부서가 엑셀로 따로 관리하던 위원회·위원 정보를 하나의 DB로 통합 관리하는 웹 시스템입니다.
**프로토타입이며 모든 데이터는 가상입니다.**

- 개발 계획: [docs/개발계획.md](docs/개발계획.md)
- 데이터 모델: [docs/데이터모델.md](docs/데이터모델.md)

## 처음 실행하기

준비물: Node.js LTS, Git, Docker Desktop (**Docker Desktop을 먼저 켜 둡니다**)

1. 패키지 설치

```bash
npm install
```

2. 접속 정보 파일 만들기 — `.env.example`을 복사해 `.env`를 만들고 그 안의 `change_me` 값들을 바꿉니다.
   - `POSTGRES_PASSWORD`와 `DATABASE_URL` 안의 비밀번호는 같은 값으로
   - `BETTER_AUTH_SECRET`은 32자 이상 아무 무작위 문자열
   - `SEED_DEFAULT_PASSWORD`는 시드 계정(u00001~u00008)의 첫 비밀번호 (8자 이상)

```bash
cp .env.example .env
```

3. DB 실행 (PostgreSQL 컨테이너)

```bash
npm run db:up
```

4. 테이블 만들기 (마이그레이션 적용 + Prisma 코드 생성)

```bash
npx prisma migrate dev
```

```bash
npm run db:generate
```

5. 예시 데이터 넣기 (여러 번 실행해도 결과가 같습니다)

```bash
npm run db:seed
```

6. 데이터 눈으로 확인 (브라우저에 Prisma Studio가 열립니다)

```bash
npm run db:studio
```

7. 웹 화면 실행 → 브라우저에서 http://localhost:3000
   - 아이디 `u00001`(총괄) 또는 `u00002`~`u00008`(부서), 비밀번호는 `.env`의 `SEED_DEFAULT_PASSWORD`
   - 처음 로그인하면 비밀번호 변경 화면이 나옵니다

```bash
npm run dev
```

## 자주 쓰는 명령

| 명령 | 하는 일 |
|---|---|
| `npm test` | 규칙 계산 테스트(Vitest) 실행 |
| `npm run db:up` / `npm run db:down` | DB 켜기 / 끄기 (데이터는 보존) |
| `npm run db:migrate` | 스키마 변경 후 마이그레이션 만들기·적용 |
| `npm run db:seed` | 예시 엑셀 데이터 넣기 |
| `npm run db:studio` | DB 내용을 화면으로 보기 |

DB를 완전히 비우고 처음부터 다시 만들려면 아래 두 명령을 차례로 실행합니다 (**모든 데이터가 지워집니다**).

```bash
npx prisma migrate reset
```

```bash
npm run db:seed
```

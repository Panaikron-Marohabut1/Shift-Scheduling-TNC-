# Project structure and Agent files

จัดโครงสร้างวันที่ 6 ตุลาคม 2026 สำหรับ **Shift schedule TNC** โดยแยกแอปปัจจุบัน ต้นแบบเก่า เอกสาร และเครื่องมือพัฒนา

## Application and prototype

แก้แอปปัจจุบันที่ `apps/api/` และ `apps/web/` เครื่องมือ setup, database และ verification อยู่ `scripts/` คำสั่งทั้งหมดเริ่มจาก root ตาม `README.md`

ต้นแบบเก่าอยู่ `prototypes/legacy-static/` พร้อมเอกสารใน `docs/` และรายงานใน `reviews/` ไม่ลบหรือแก้พฤติกรรมแอปเดิม ย้ายไฟล์จาก `shift/` รวม `.vscode` ไว้ครบ และคงเนื้อหาเอกสารเก่าไว้ อ้างอิง path เดิมในเอกสารเก่าได้ตามคำอธิบายใน README ของต้นแบบ

Requirements, backlog และ baseline กฎหมายยังอยู่ `.docs/01-requirements/` ไม่มีการเปลี่ยน requirement IDs หรือ business decisions ในการจัดโครงสร้างครั้งนี้

## Shared Agent content

`AGENTS.md` เป็นคำแนะนำโปรเจคกลาง `CLAUDE.md` import ไฟล์นี้ด้วย `@AGENTS.md` เพื่อไม่ให้ต้องดูแลกฎชุดเดียวกันสองไฟล์

Workflow audit กลางอยู่ `.agents/skills/audit-backlog/SKILL.md` Codex อ่านตรงจากตำแหน่งนี้ ส่วน `.claude/skills/audit-backlog/SKILL.md` เป็นทางเข้าสั้นที่สั่งให้อ่าน workflow กลางก่อนทำงาน ไม่สร้างสำเนากฎ audit อีกชุด และไม่ต้องสร้าง symlink บน Windows

Impeccable ยังเก็บแยกตามเวอร์ชันที่ติดตั้ง: `.agents/skills/impeccable/` เป็น 4.3.1 ของ Codex และ `.claude/skills/impeccable/` เป็น 4.2.1 ของ Claude ข้อความ ตัวช่วย และ binary ต่างกัน การรวมทั้งชุดจะเป็นการเปลี่ยนเวอร์ชัน จึงไม่ได้ทำในการจัดไฟล์ครั้งนี้

## Tool entry points

คง `.agents/skills/` สำหรับการค้นหา skills ของ Codex และ `.codex/agents/*.toml` สำหรับ Agent ของ Codex ตาม [OpenAI Docs](https://learn.chatgpt.com/docs/build-skills) และ [Custom agents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

คง `.claude/agents/*.md`, `.claude/skills/*/SKILL.md` และการตั้งค่า Claude สำหรับ Claude Code ไฟล์ Agent ใช้ format ต่างจาก Codex จึงไม่ย้ายรวมเป็นโฟลเดอร์ทั่วไป การ import กฎกลางอาศัย [CLAUDE.md imports](https://code.claude.com/docs/en/memory#import-additional-files) และทางเข้า skill ใช้ [supporting references](https://code.claude.com/docs/en/skills#add-supporting-files)

แก้กฎโปรเจคที่ `AGENTS.md`, แก้ workflow audit ที่ `.agents/skills/audit-backlog/SKILL.md`, และแก้การตั้งค่าเฉพาะเครื่องมือในโฟลเดอร์ของเครื่องมือนั้น คงชื่อ entry point เหล่านี้เพื่อให้เครื่องมือค้นหาเจอ

`.impeccable/` ใช้สำหรับผลและ cache ที่เครื่องมือสร้าง จึงคงชื่อและ ignore ใน Git รายงานเก่าที่ต้องเก็บอ้างอิงย้ายไว้ข้าง legacy prototype แล้ว `.claude/settings.local.json`, `.env`, `.local/`, generated fonts, build output และ dependencies ไม่เข้า Git

## Verification

ตรวจ SHA-256 ของไฟล์ต้นแบบเดิมก่อนและหลังย้าย ตรวจ import/skill references, Markdown links และ syntax ใช้ audit parity ตรวจ spec/backlog โดยไม่แก้เนื้อหา การย้ายนี้ไม่เปลี่ยน route ของแอปปัจจุบันที่ `http://localhost:3000`

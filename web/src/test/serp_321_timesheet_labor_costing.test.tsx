import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { ERPProvider, useERP } from "../context/ERPContext";
import * as apiGateway from "../services/apiGateway";
import { JobDetailView } from "../components/jobs/JobDetailView";
import { LaborTimeEntryModal } from "../components/jobs/LaborTimeEntryModal";
import { JobOrder } from "../types/erp";

// SERP-321 — Technician timesheets & job labor costing
//
// Acceptance criteria exercised here:
//   1. Technicians can clock labor hours against a specific job card task.
//   2. Labor cost is calculated as hours × technician hourly cost rate.
//   3. Job margin analysis updates labor-vs-parts profit margin in real time.

describe("SERP-321: Technician timesheets & job labor costing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function buildHarness(erpRef: () => ReturnType<typeof useERP>) {
    const Harness = () => {
      const erp = useERP();
      Object.assign(erpRef as any, erpRef() ?? {});
      (erpRef as any).erp = erp;
      return (
        <div>
          <div data-testid="jobs-count">{erp.jobs.length}</div>
          <div data-testid="labor-count">{erp.laborEntries.length}</div>
          <div data-testid="pending">{erp.mutationPending ? "PENDING" : "IDLE"}</div>
          <button
            data-testid="create-job-btn"
            onClick={() => {
              erp.createJob({
                customerId: "cust-1",
                customerName: "Ahmed Rauf",
                customerPhone: "+960 778-4321",
                vehicle: { plateNumber: "AB1-8842", make: "Toyota", model: "Prado", year: 2021, color: "White", type: "Car" },
                serviceType: "Full Body Repaint",
                requestedWork: "Full repaint",
                quotedAmount: 10000,
                depositPaid: 4000,
                balanceDue: 6000,
                assignedStaff: [{ id: "st-1", name: "Ahsan", role: "Lead Painter", hourlyCostRateMvr: 450 }],
                status: "In Progress",
                priority: "Normal",
                startDate: "2026-09-08",
                expectedCompletionDate: "2026-09-15",
                estimatedMaterialCost: 2000,
                laborCostEstimate: 3000,
                targetMarginPercentage: 50,
                bayNumber: "Bay 1",
              });
            }}
          >
            Create Job
          </button>
          <button
            data-testid="clock-btn"
            onClick={() => {
              erp.addLaborEntry({
                jobId: erp.jobs[0]?.id ?? "",
                technicianId: "st-1",
                technicianName: "Ahsan",
                hourlyCostRateMvr: 450,
                taskDescription: "Rear quarter prep & primer",
                hoursWorked: 2,
              });
            }}
          >
            Clock Hours
          </button>
        </div>
      );
    };
    return Harness;
  }

  it("calculates labor cost from technician hourly cost rate and updates job margin in real time", async () => {
    vi.spyOn(apiGateway, "dispatchCommand").mockResolvedValue({ ok: true } as any);

    let erpState: ReturnType<typeof useERP> = null as any;
    const Harness = buildHarness(() => erpState);

    const Wrap = () => {
      erpState = useERP();
      return <Harness />;
    };

    render(
      <ERPProvider>
        <Wrap />
      </ERPProvider>
    );

    // Create the job so there is a job card to clock against.
    await act(async () => {
      screen.getByTestId("create-job-btn").click();
    });

    const jobId = erpState.jobs[0].id;
    expect(jobId).toBeTruthy();
    expect(erpState.jobs[0].actualLaborCost).toBe(0);
    expect(erpState.jobs[0].totalLaborHours).toBe(0);
    // Bug 3 regression trap: a fresh job has zero actual material and labor cost,
    // so initial profit must equal the quoted amount — not quoted minus the labor estimate.
    expect(erpState.jobs[0].actualProfit).toBe(10000);

    // Clock 2 hours at MVR 450/hr => MVR 900 labor cost.
    await act(async () => {
      screen.getByTestId("clock-btn").click();
    });

    expect(erpState.laborEntries.length).toBe(1);
    const entry = erpState.laborEntries[0];
    expect(entry.technicianId).toBe("st-1");
    expect(entry.taskDescription).toBe("Rear quarter prep & primer");
    expect(entry.hourlyCostRateMvr).toBe(450);
    // Acceptance 2: labor cost = hours × rate
    expect(entry.totalCostMvr).toBe(900);

    const updated = erpState.jobs[0];
    expect(updated.actualLaborCost).toBe(900);
    expect(updated.totalLaborHours).toBe(2);
    // Acceptance 3: real-time margin update. Profit = quoted − (parts + labor).
    // Parts (actualMaterialCost) start at 0 on a new job; labor = 900.
    //      10000 − (0 + 900) = 9100
    expect(updated.actualProfit).toBe(9100);

    // Clocking a second entry accumulates totals.
    await act(async () => {
      screen.getByTestId("clock-btn").click();
    });
    expect(erpState.laborEntries.length).toBe(2);
    expect(erpState.jobs[0].actualLaborCost).toBe(1800);
    expect(erpState.jobs[0].totalLaborHours).toBe(4);
    expect(erpState.jobs[0].actualProfit).toBe(10000 - (0 + 1800));
  });

  it("rolls back the labor entry and job totals when the authoritative WORK command is rejected", async () => {
    // First call (createJob) succeeds, second call (timesheet) is rejected with ApiError.
    vi.spyOn(apiGateway, "dispatchCommand")
      .mockResolvedValueOnce({ ok: true } as any)
      .mockRejectedValueOnce(new apiGateway.ApiError(403, "timesheet_rejected"));

    let erpState: ReturnType<typeof useERP> = null as any;
    const Harness = buildHarness(() => erpState);
    const Wrap = () => {
      erpState = useERP();
      return <Harness />;
    };

    render(
      <ERPProvider>
        <Wrap />
      </ERPProvider>
    );

    await act(async () => {
      screen.getByTestId("create-job-btn").click();
    });
    expect(erpState.jobs[0].actualLaborCost).toBe(0);

    await act(async () => {
      screen.getByTestId("clock-btn").click();
    });

    // Rejected authoritative command => entry rolled back, job totals restored.
    expect(erpState.laborEntries.length).toBe(0);
    expect(erpState.jobs[0].actualLaborCost).toBe(0);
    expect(erpState.jobs[0].totalLaborHours).toBe(0);
    // Bug 2 regression trap: profit must be recomputed from the REVERTED labor
    // cost (0), not the stale pre-rollback 900 — so profit returns to quoted (10000).
    expect(erpState.jobs[0].actualProfit).toBe(10000);
    expect(erpState.mutationPending).toBe(false);
  });

  it("LaborTimeEntryModal surfaces technicians with hourly cost rate and previews hours × rate labor cost", async () => {
    vi.spyOn(apiGateway, "dispatchCommand").mockResolvedValue({ ok: true } as any);

    const job: JobOrder = {
      id: "job-x",
      jobId: "IGN-0999",
      customerId: "cust-1",
      customerName: "Ahmed Rauf",
      customerPhone: "+960 778-4321",
      vehicle: { plateNumber: "AB1-8842", make: "Toyota", model: "Prado", year: 2021, color: "White", type: "Car" },
      serviceType: "Full Body Repaint",
      requestedWork: "Full repaint",
      quotedAmount: 10000,
      depositPaid: 0,
      balanceDue: 10000,
      assignedStaff: [{ id: "st-1", name: "Ahsan", role: "Lead Painter", hourlyCostRateMvr: 450 }],
      status: "In Progress",
      priority: "Normal",
      startDate: "2026-09-08",
      expectedCompletionDate: "2026-09-15",
      materialsUsed: [],
      estimatedMaterialCost: 2000,
      actualMaterialCost: 0,
      laborCostEstimate: 3000,
      actualLaborCost: 0,
      totalLaborHours: 0,
      targetMarginPercentage: 50,
      actualProfit: 0,
      bayNumber: "Bay 1",
    };

    let erpState: ReturnType<typeof useERP> = null as any;
    const ModalWrap = () => {
      erpState = useERP();
      return <LaborTimeEntryModal job={job} isOpen onClose={() => {}} />;
    };

    render(
      <ERPProvider>
        <ModalWrap />
      </ERPProvider>
    );

    // Technician with hourly cost rate is offered for clocking.
    const ahsanOption = screen.getByText(/Ahsan.*Lead Painter.*450\.00\/hr/);
    expect(ahsanOption).toBeDefined();

    // Enter a task and 3 hours => labor cost = 3 × 450 = 1350, shown live.
    fireEvent.change(screen.getByLabelText(/Task Description \*/), { target: { value: "Wet sand & polish" } });
    fireEvent.change(screen.getByLabelText(/Hours Worked \*/), { target: { value: "3" } });
    expect(screen.getByRole("button", { name: /1,350/ })).toBeDefined();

    // Confirm posts the entry (submission path wired to addLaborEntry).
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(erpState.laborEntries.length).toBe(1);
    expect(erpState.laborEntries[0].totalCostMvr).toBe(1350);
  });

  it("renders JobDetailView without a TDZ runtime crash and shows the Technician Labor section", async () => {
    vi.spyOn(apiGateway, "dispatchCommand").mockResolvedValue({ ok: true } as any);

    // A job must exist in the ERP store before JobDetailView can resolve it from
    // the :id route param. Seed it through the real createJob path inside the
    // same provider so both the context state and the rendered view stay in sync.
    const JobHarness = () => {
      const erp = useERP();
      const [readyPath, setReadyPath] = React.useState<string | null>(null);
      React.useEffect(() => {
        if (erp.jobs.length > 0 && !readyPath) setReadyPath(`/jobs/${erp.jobs[0].id}`);
      }, [erp.jobs, readyPath]);
      React.useEffect(() => {
        if (!readyPath && erp.jobs.length === 0) {
          erp.createJob({
            customerId: "cust-1",
            customerName: "Ahmed Rauf",
            customerPhone: "+960 778-4321",
            vehicle: { plateNumber: "AB1-8842", make: "Toyota", model: "Prado", year: 2021, color: "White", type: "Car" },
            serviceType: "Full Body Repaint",
            requestedWork: "Full repaint",
            quotedAmount: 10000,
            depositPaid: 4000,
            balanceDue: 6000,
            assignedStaff: [{ id: "st-1", name: "Ahsan", role: "Lead Painter", hourlyCostRateMvr: 450 }],
            status: "In Progress",
            priority: "Normal",
            startDate: "2026-09-08",
            expectedCompletionDate: "2026-09-15",
            estimatedMaterialCost: 2000,
            laborCostEstimate: 3000,
            targetMarginPercentage: 50,
            bayNumber: "Bay 1",
          });
        }
      }, [erp, readyPath]);
      if (!readyPath) return null;
      return <Navigate to={readyPath} replace />;
    };

    // Bug 1 regression trap: this must render the REAL component, not a harness.
    // jobLabor references the job lookup, so if the job declaration ever regresses
    // to after jobLabor, this render throws ReferenceError and the test fails.
    expect(() => {
      render(
        <MemoryRouter initialEntries={["/seed-job"]}>
          <ERPProvider>
            <Routes>
              <Route path="/jobs/:id" element={<JobDetailView />} />
              {/* The harness seeds the job then redirects to its route. */}
              <Route path="*" element={<JobHarness />} />
            </Routes>
          </ERPProvider>
        </MemoryRouter>
      );
    }).not.toThrow();

    // The newly created job (e.g. STA-0240) resolves via useParams, so the
    // header renders the generated job number and the SERP-321 labor section.
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent).toMatch(/^[A-Z]+-\d{4}$/);
    expect(screen.getAllByText(/Technician Labor/).length).toBeGreaterThan(0);
    expect(screen.getByText("Clock Hours")).toBeDefined();
    // No labor hours are seeded, so the empty state shows instead of a render error.
    expect(screen.getByText(/No labor hours logged yet/)).toBeDefined();
  });
});

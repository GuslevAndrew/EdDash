"use client";

type PageSizeSelectProps = {
  allowedPageSizes: readonly number[];
  value: number;
};

export function PageSizeSelect({ allowedPageSizes, value }: PageSizeSelectProps) {
  return (
    <select
      id="pageSize"
      name="pageSize"
      defaultValue={value}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
    >
      {allowedPageSizes.map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
      {!allowedPageSizes.includes(value) ? <option value={value}>{value}</option> : null}
    </select>
  );
}

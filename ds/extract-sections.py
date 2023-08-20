# Use this to update the ScheduleOfClasses fetcher for new semesters

# %%
import polars as pl

# %%
soc = pl.read_csv('FA2023.csv', dtypes={'Catalog Nbr': pl.Utf8})
soc['Subject']

# %%
course_sections = soc.with_columns([
    (soc['Subject'].str.extract(r'.+\(([A-Z]+)\)') + soc['Catalog Nbr']).alias('CourseCode')
])  .groupby('CourseCode')\
    .agg([pl.col('Section').unique()])
course_sections

# %%
output_obj = { code: sections for code, sections in course_sections.iter_rows() }

# %%
import json
with open('sections-2460.json', 'w+') as jsonfile:
    json.dump(output_obj, jsonfile, separators=(',', ':'))



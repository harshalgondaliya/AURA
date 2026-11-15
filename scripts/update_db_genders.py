"""
scripts/update_db_genders.py
Populates gender, index_name, section_name, and department_name in PostgreSQL
for all products, and adds additional high-quality Menswear catalog items so
Men has a rich collection across all slots.
"""

import subprocess
import pandas as pd

def main():
    print("Reading article IDs from PostgreSQL...")
    out = subprocess.check_output(
        ['docker', 'exec', '-i', 'fashion_postgres', 'psql', '-U', 'postgres', '-d', 'fashion_db', '-t', '-c', 'SELECT article_id FROM products;']
    )
    existing_aids = set(line.strip().decode() for line in out.splitlines() if line.strip())
    print(f"Existing products in DB: {len(existing_aids)}")

    print("Loading cleaned HM articles parquet...")
    df_hm = pd.read_parquet('data/processed/hm_articles_cleaned.parquet')

    def classify_gender(row):
        ig = str(row.get('index_group_name', '')).strip()
        idx = str(row.get('index_name', '')).strip()
        sec = str(row.get('section_name', '')).strip()
        if ig == 'Baby/Children' or 'children' in idx.lower() or 'baby' in idx.lower():
            return 'Kids'
        if ig == 'Menswear' or 'men ' in sec.lower() or 'menswear' in idx.lower() or sec.lower().startswith('men'):
            return 'Men'
        if ig == 'Ladieswear' or 'ladies' in idx.lower() or 'lingeries' in idx.lower() or 'ladies' in sec.lower():
            return 'Women'
        if ig == 'Sport' or idx == 'Sport':
            return 'Unisex'
        if ig == 'Divided':
            if 'men' in sec.lower():
                return 'Men'
            return 'Women'
        return 'Unknown'

    df_hm['normalized_gender'] = df_hm.apply(classify_gender, axis=1)

    # 1. Update existing products in DB
    sub = df_hm[df_hm['article_id'].isin(existing_aids)].copy()
    print(f"Updating {len(sub)} existing products...")

    sql_path = 'scripts/update_batch.sql'
    with open(sql_path, 'w', encoding='utf-8') as f:
        f.write('BEGIN;\n')
        # Create temp table for bulk update
        f.write('CREATE TEMP TABLE tmp_gender_updates (article_id VARCHAR(16), gender VARCHAR(32), index_name VARCHAR(64), section_name VARCHAR(64), department_name VARCHAR(64));\n')
        f.write('COPY tmp_gender_updates FROM stdin;\n')
        for _, row in sub.iterrows():
            aid = str(row['article_id'])
            g = str(row['normalized_gender'])
            idx = str(row.get('index_name', '')).replace('\t', ' ')
            sec = str(row.get('section_name', '')).replace('\t', ' ')
            dept = str(row.get('department_name', '')).replace('\t', ' ')
            f.write(f"{aid}\t{g}\t{idx}\t{sec}\t{dept}\n")
        f.write('\\.\n')
        f.write('''
            UPDATE products p
            SET gender = t.gender,
                index_name = t.index_name,
                section_name = t.section_name,
                department_name = t.department_name
            FROM tmp_gender_updates t
            WHERE p.article_id = t.article_id;
        ''')
        f.write('DROP TABLE tmp_gender_updates;\n')

        # 2. Add extra 1,500 active Menswear items with images across slots
        men_candidates = df_hm[
            (df_hm['normalized_gender'] == 'Men') & 
            (df_hm['has_image'] == 1) & 
            (~df_hm['article_id'].isin(existing_aids))
        ]
        print(f"Available extra Menswear items with images: {len(men_candidates)}")
        sample_men = men_candidates.sample(n=min(1500, len(men_candidates)), random_state=42)

        f.write('CREATE TEMP TABLE tmp_new_men (article_id VARCHAR(16), prod_name VARCHAR(128), product_type_name VARCHAR(64), product_group_name VARCHAR(64), standard_category VARCHAR(32), colour_group_name VARCHAR(64), perceived_colour_value_name VARCHAR(64), department_name VARCHAR(64), index_name VARCHAR(64), section_name VARCHAR(64), gender VARCHAR(32), detail_desc TEXT, price_cents INTEGER, has_image BOOLEAN, is_active BOOLEAN);\n')
        f.write('COPY tmp_new_men FROM stdin;\n')
        for _, row in sample_men.iterrows():
            aid = str(row['article_id'])
            pname = str(row['prod_name']).replace('\t', ' ')[:120]
            ptype = str(row['product_type_name']).replace('\t', ' ')[:60]
            pgroup = str(row['product_group_name']).replace('\t', ' ')[:60]
            scat = str(row['standard_category']).replace('\t', ' ')[:30]
            col = str(row['colour_group_name']).replace('\t', ' ')[:60]
            pcol = str(row.get('perceived_colour_value_name', '')).replace('\t', ' ')[:60]
            dept = str(row.get('department_name', '')).replace('\t', ' ')[:60]
            idx = str(row.get('index_name', '')).replace('\t', ' ')[:60]
            sec = str(row.get('section_name', '')).replace('\t', ' ')[:60]
            desc = str(row.get('detail_desc_clean', '')).replace('\t', ' ').replace('\n', ' ')
            f.write(f"{aid}\t{pname}\t{ptype}\t{pgroup}\t{scat}\t{col}\t{pcol}\t{dept}\t{idx}\t{sec}\tMen\t{desc}\t2999\tt\tt\n")
        f.write('\\.\n')
        f.write('''
            INSERT INTO products (article_id, prod_name, product_type_name, product_group_name, standard_category, colour_group_name, perceived_colour_value_name, department_name, index_name, section_name, gender, detail_desc, price_cents, has_image, is_active)
            SELECT article_id, prod_name, product_type_name, product_group_name, standard_category, colour_group_name, perceived_colour_value_name, department_name, index_name, section_name, gender, detail_desc, price_cents, has_image, is_active
            FROM tmp_new_men
            ON CONFLICT (article_id) DO NOTHING;
        ''')
        f.write('DROP TABLE tmp_new_men;\n')
        f.write('COMMIT;\n')

    print(f"Applying updates to PostgreSQL via psql...")
    with open(sql_path, 'r', encoding='utf-8') as f:
        res = subprocess.run(
            ['docker', 'exec', '-i', 'fashion_postgres', 'psql', '-U', 'postgres', '-d', 'fashion_db'],
            stdin=f,
            capture_output=True,
            text=True
        )
    print("PSQL stdout:", res.stdout[-200:] if res.stdout else "None")
    if res.stderr:
        print("PSQL stderr:", res.stderr[-200:])
    print("Migration finished!")

if __name__ == '__main__':
    main()

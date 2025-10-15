import json
from df_imoveis import collect_df_imoveis_properties
from wimoveis import collect_wimoveis_properties

def main():
    print("Coletando imóveis do DF Imóveis...")
    df_properties = collect_df_imoveis_properties()
    print("Coletando imóveis do Wimoveis...")
    wimoveis_properties = collect_wimoveis_properties()
    all_properties = df_properties + wimoveis_properties
    print(f"Total de imóveis coletados: {len(all_properties)}")
    with open("imoveis.json", "w", encoding="utf-8") as f:
        json.dump(all_properties, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
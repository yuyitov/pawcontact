"""Puente para generator-closed-lists.test.mjs — no se corre a mano.

Lee {"opciones": {"<lista>": ["texto de la opción", ...]}} por stdin y devuelve
por stdout lo que los normalizadores REALES del generador hacen con cada una.

Existe porque dos de las listas cerradas de PawContact no las decide el worker
(JavaScript) sino el generador (Python), y una prueba que solo mire el worker
las da por buenas. Se importan las funciones del módulo que se despliega, no
copias: si la tabla de alias cambia, esto cambia con ella.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "generator"))

from build_client_from_intake import (  # noqa: E402
    normalize_business_type,
    normalize_primary_cta,
)

# `primary_cta` se normaliza DOS veces en el camino real y la primera manda:
# build_client_from_intake escribe ya normalizado en el JSON del cliente, así que
# si ahí sale None, generate_service_menu nunca ve el texto original. Por eso se
# mide la de build_client, que es la que decide.
NORMALIZADORES = {
    "primary_cta": normalize_primary_cta,
    "business_type": normalize_business_type,
}


def main() -> int:
    entrada = json.load(sys.stdin)
    salida = {}
    for lista, opciones in entrada.get("opciones", {}).items():
        fn = NORMALIZADORES.get(lista)
        if fn is None:
            salida[lista] = {o: "__SIN_NORMALIZADOR__" for o in opciones}
            continue
        salida[lista] = {o: fn(o) for o in opciones}
    json.dump(salida, sys.stdout, ensure_ascii=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
